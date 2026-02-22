/**
 * Script 15: Backfill responsive image variants
 *
 * Phase 2 — Product Catalog (Image Optimizer)
 *
 * Downloads each existing image from S3, generates 4 responsive sizes
 * (thumb 150px, sm 400px, md 800px, lg 1200px) in WebP via Sharp,
 * uploads them back to S3, and inserts `image_variant` records.
 *
 * Idempotent: Skips images that already have variants in `image_variant`.
 *
 * Prerequisites:
 *   - Script 04 (migrate-images) must have run (1,311 images in `image` table)
 *   - `npx medusa db:migrate` must have created `image_variant` table
 *   - AWS env vars set: AWS_S3_BUCKET_NAME, AWS_CLOUDFRONT_DOMAIN,
 *     AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *
 * Usage:
 *   npx ts-node 15-backfill-responsive-images.ts
 *   npx ts-node 15-backfill-responsive-images.ts --limit 50 --offset 0
 *   npx ts-node 15-backfill-responsive-images.ts --product-id <uuid>
 *   npx ts-node 15-backfill-responsive-images.ts --dry-run
 */

import { Client as PgClient } from "pg"
import { randomUUID } from "crypto"

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const PG_CONFIG = {
  host: "localhost",
  port: 5432,
  database: "vaighaweaves_db_dev",
  user: "prudhviprabhat",
}

const IMAGE_SIZES = {
  thumb: { width: 150, height: 200 },
  sm: { width: 400, height: 533 },
  md: { width: 800, height: 1067 },
  lg: { width: 1200, height: 1600 },
} as const

const QUALITY = 85
const FORMAT = "webp"
const CONCURRENCY = 10 // process 10 images in parallel

// ─────────────────────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2)
  const opts: {
    limit: number
    offset: number
    productId: string | null
    dryRun: boolean
  } = {
    limit: 0, // 0 = no limit (all)
    offset: 0,
    productId: null,
    dryRun: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--limit":
        opts.limit = parseInt(args[++i], 10)
        break
      case "--offset":
        opts.offset = parseInt(args[++i], 10)
        break
      case "--product-id":
        opts.productId = args[++i]
        break
      case "--dry-run":
        opts.dryRun = true
        break
    }
  }

  return opts
}

// ─────────────────────────────────────────────────────────────────────────────
// S3 helpers
// ─────────────────────────────────────────────────────────────────────────────
let s3Client: any = null

function getS3() {
  if (!s3Client) {
    const { S3Client } = require("@aws-sdk/client-s3")
    s3Client = new S3Client({
      region: process.env.AWS_REGION || "ap-south-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    })
  }
  return s3Client
}

async function downloadFromS3(key: string): Promise<Buffer> {
  const { GetObjectCommand } = require("@aws-sdk/client-s3")
  const client = getS3()
  const bucket = process.env.AWS_S3_BUCKET_NAME || ""

  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  const response = await client.send(command)
  const chunks: Uint8Array[] = []
  for await (const chunk of response.Body) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function uploadToS3(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const { Upload } = require("@aws-sdk/lib-storage")
  const client = getS3()
  const bucket = process.env.AWS_S3_BUCKET_NAME || ""
  const cdn = process.env.AWS_CLOUDFRONT_DOMAIN || ""

  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "max-age=31536000, immutable",
    },
  })

  await upload.done()

  if (cdn) {
    return `https://${cdn}/${key}`
  }
  return `https://${bucket}.s3.amazonaws.com/${key}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Image processing
// ─────────────────────────────────────────────────────────────────────────────
interface SizedImage {
  size: string
  buffer: Buffer
  width: number
  height: number
}

async function generateSizes(buffer: Buffer): Promise<SizedImage[]> {
  const sharp = require("sharp")
  const metadata = await sharp(buffer).metadata()
  const originalWidth = metadata.width || 1200
  const results: SizedImage[] = []

  for (const [sizeName, dims] of Object.entries(IMAGE_SIZES)) {
    if (dims.width > originalWidth) continue

    const resized = await sharp(buffer)
      .resize(dims.width, dims.height, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer()

    const resizedMeta = await sharp(resized).metadata()
    results.push({
      size: sizeName,
      buffer: resized,
      width: resizedMeta.width || dims.width,
      height: resizedMeta.height || dims.height,
    })
  }

  return results
}

function generateS3Key(productId: string, imageId: string, sizeName: string): string {
  return `products/${productId}/${imageId}-${sizeName}.${FORMAT}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Process a single image
// ─────────────────────────────────────────────────────────────────────────────
async function processImage(
  pgClient: PgClient,
  image: { id: string; url: string; product_id: string },
  dryRun: boolean
): Promise<{ processed: number; skipped: boolean; error?: string }> {
  // Check if already processed
  const existing = await pgClient.query(
    `SELECT id FROM image_variant WHERE image_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [image.id]
  )
  if (existing.rows.length > 0) {
    return { processed: 0, skipped: true }
  }

  if (dryRun) {
    console.log(`  [DRY-RUN] Would process: ${image.id} (${image.url})`)
    return { processed: 0, skipped: false }
  }

  // Download original from S3
  const originalBuffer = await downloadFromS3(image.url)

  // Generate responsive sizes
  const sizes = await generateSizes(originalBuffer)

  // Upload each size and insert DB record
  for (const sized of sizes) {
    const s3Key = generateS3Key(image.product_id, image.id, sized.size)
    const url = await uploadToS3(sized.buffer, s3Key, `image/${FORMAT}`)
    const now = new Date().toISOString()

    await pgClient.query(
      `INSERT INTO image_variant (id, image_id, size, url, s3_key, width, height, format, file_size, processed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        randomUUID(),
        image.id,
        sized.size,
        url,
        s3Key,
        sized.width,
        sized.height,
        FORMAT,
        sized.buffer.length,
        now,
        now,
      ]
    )
  }

  return { processed: sizes.length, skipped: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch processing with concurrency control
// ─────────────────────────────────────────────────────────────────────────────
async function processBatch(
  pgClient: PgClient,
  images: { id: string; url: string; product_id: string }[],
  dryRun: boolean,
  stats: { processed: number; skipped: number; failed: number; errors: string[] }
) {
  const promises = images.map(async (image) => {
    try {
      const result = await processImage(pgClient, image, dryRun)
      if (result.skipped) {
        stats.skipped++
      } else {
        stats.processed += result.processed
      }
    } catch (err: any) {
      stats.failed++
      const msg = `${image.id}: ${err.message}`
      stats.errors.push(msg)
      console.error(`  ERROR: ${msg}`)
    }
  })

  await Promise.all(promises)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs()
  let pgClient: PgClient | null = null

  console.log("╔══════════════════════════════════════════════════════════════╗")
  console.log("║  Script 15: Backfill Responsive Images                     ║")
  console.log("╚══════════════════════════════════════════════════════════════╝")
  console.log()

  if (opts.dryRun) {
    console.log("🔍 DRY RUN — no images will be processed or uploaded\n")
  }

  try {
    pgClient = new PgClient(PG_CONFIG)
    await pgClient.connect()
    console.log("✅ PostgreSQL connected\n")

    // Validate env vars (skip for dry run)
    if (!opts.dryRun) {
      const required = ["AWS_S3_BUCKET_NAME", "AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]
      const missing = required.filter((k) => !process.env[k])
      if (missing.length > 0) {
        throw new Error(`Missing env vars: ${missing.join(", ")}`)
      }
    }

    // Build query
    let query = `SELECT id, url, product_id FROM image WHERE url IS NOT NULL AND url != '' AND deleted_at IS NULL`
    const params: any[] = []
    let paramIdx = 1

    if (opts.productId) {
      query += ` AND product_id = $${paramIdx++}`
      params.push(opts.productId)
    }

    query += ` ORDER BY product_id, id`

    if (opts.limit > 0) {
      query += ` LIMIT $${paramIdx++}`
      params.push(opts.limit)
    }

    if (opts.offset > 0) {
      query += ` OFFSET $${paramIdx++}`
      params.push(opts.offset)
    }

    const { rows: images } = await pgClient.query(query, params)
    console.log(`📷 Found ${images.length} images to process`)
    if (opts.productId) console.log(`   Filtered to product: ${opts.productId}`)
    if (opts.limit) console.log(`   Limit: ${opts.limit}, Offset: ${opts.offset}`)
    console.log()

    const stats = {
      processed: 0,   // total variant records created
      skipped: 0,     // images already processed
      failed: 0,      // images that errored
      errors: [] as string[],
    }

    // Process in batches of CONCURRENCY
    for (let i = 0; i < images.length; i += CONCURRENCY) {
      const batch = images.slice(i, i + CONCURRENCY)
      const batchNum = Math.floor(i / CONCURRENCY) + 1
      const totalBatches = Math.ceil(images.length / CONCURRENCY)
      console.log(`  Batch ${batchNum}/${totalBatches} (images ${i + 1}-${Math.min(i + CONCURRENCY, images.length)})...`)

      await processBatch(pgClient, batch, opts.dryRun, stats)
    }

    // Summary
    console.log()
    console.log("────────────────────────────────────────────────────────────────")
    console.log("  SUMMARY")
    console.log("────────────────────────────────────────────────────────────────")
    console.log(`  Total images:    ${images.length}`)
    console.log(`  Variants created: ${stats.processed}`)
    console.log(`  Already existed:  ${stats.skipped}`)
    console.log(`  Failed:           ${stats.failed}`)

    if (stats.errors.length > 0) {
      console.log()
      console.log("  ERRORS (first 10):")
      for (const err of stats.errors.slice(0, 10)) {
        console.log(`    - ${err}`)
      }
    }

    // Verify counts
    const { rows: countRows } = await pgClient.query(
      `SELECT COUNT(*) as cnt FROM image_variant WHERE deleted_at IS NULL`
    )
    console.log()
    console.log(`  Total image_variant rows in DB: ${countRows[0].cnt}`)
    console.log()

    if (stats.failed === 0) {
      console.log("✅ Backfill complete!")
    } else {
      console.log(`⚠️  Backfill complete with ${stats.failed} errors. Re-run to retry failed images.`)
    }

  } catch (err: any) {
    console.error("❌ Fatal error:", err.message)
    process.exit(1)
  } finally {
    if (pgClient) await pgClient.end()
  }
}

main()
