/**
 * SCRIPT 04: Migrate Product Images
 *
 * Purpose:
 * - Migrate product_images from MySQL to Medusa image table
 * - Set product.thumbnail to the primary image URL
 * - Preserve design_name, sku, stock_quantity, etc. in metadata
 * - Only migrate ACTIVE images (deleted_at IS NULL AND status = 'ACTIVE')
 *
 * Medusa schema notes:
 * - Table is called `image` (not `product_image`)
 * - Has direct product_id FK (TEXT), url (TEXT), rank (INT), metadata (JSONB)
 * - No unique index on url - duplicates allowed
 *
 * Complexity: ⭐⭐ MEDIUM (product FK resolution + thumbnail update)
 * Duration: ~30-60 seconds (1311 images)
 *
 * Prerequisites: Scripts 01, 02, 03 must have run successfully
 *
 * Run: npm run script:04
 */

import { Client as PgClient } from 'pg'
import mysql from 'mysql2/promise'
import * as crypto from 'crypto'

// ============================================================================
// CONFIGURATION
// ============================================================================

const OLD_DB_CONFIG = {
  host: process.env.OLD_DB_HOST || 'yamabiko.proxy.rlwy.net',
  port: parseInt(process.env.OLD_DB_PORT || '45132'),
  user: process.env.OLD_DB_USER || 'root',
  password: process.env.OLD_DB_PASSWORD || 'dZnlTmgUAXBBEZejWJsnmfNsmhNVAthf',
  database: process.env.OLD_DB_NAME || 'railway',
}

const NEW_DB_CONFIG = {
  host: process.env.NEW_DB_HOST || 'localhost',
  port: parseInt(process.env.NEW_DB_PORT || '5432'),
  user: process.env.NEW_DB_USER || 'prudhvi',
  password: process.env.NEW_DB_PASSWORD || 'Oldisgold%402026',
  database: process.env.NEW_DB_NAME || 'vaighaweaves_db_dev',
}

const VERBOSE = process.env.VERBOSE !== 'false'

// ============================================================================
// TYPES (MySQL columns are snake_case)
// ============================================================================

interface OldProductImage {
  id: number
  product_id: number
  variant_id: number | null
  image_url: string
  alt_text: string | null
  is_primary: number // tinyint(1)
  sort_order: number
  created_at: Date
  description: string | null
  sku: string | null
  stock_quantity: number | null
  upload_date: Date
  uploaded_by: string | null
  design_name: string | null
  use_youtube_sku: number // tinyint(1)
  archived_at: Date | null
  deleted_at: Date | null
  replaced_by_id: number | null
  status: string
  version: number
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateUUIDFromId(tableName: string, oldId: number): string {
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  const text = `${tableName}:${oldId}`
  const hash = crypto
    .createHash('sha1')
    .update(namespace + text)
    .digest()
  const hex = hash.toString('hex')
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    '5' + hex.substring(13, 16),
    ((0x8 | (parseInt(hex[16], 16) & 0x3)).toString(16)) + hex.substring(17, 20),
    hex.substring(20, 32),
  ].join('-')
}

async function connectMySQL() {
  const connection = await mysql.createConnection(OLD_DB_CONFIG)
  return connection
}

async function connectPostgreSQL() {
  const client = new PgClient(NEW_DB_CONFIG)
  await client.connect()
  return client
}

// ============================================================================
// MAIN MIGRATION
// ============================================================================

async function migrateImages(
  mysqlConnection: any,
  pgClient: PgClient
): Promise<void> {
  console.log('\n🖼️  Starting image migration...\n')

  try {
    // Step 1: Fetch all active images from MySQL
    console.log('📥 Reading images from MySQL...')
    const [rows] = await mysqlConnection.query(
      `SELECT * FROM product_images
       WHERE deleted_at IS NULL AND status = 'ACTIVE'
       ORDER BY product_id ASC, sort_order ASC`
    )
    const oldImages = rows as OldProductImage[]
    console.log(`   Found ${oldImages.length} active images`)

    if (oldImages.length === 0) {
      console.log('   ⚠️  No images found to migrate')
      return
    }

    // Step 2: Load product ID mappings from migration_id_map
    console.log('\n🔗 Loading product ID mappings...')
    const productMapResult = await pgClient.query(
      `SELECT old_id, new_id FROM migration_id_map WHERE old_table = 'products'`
    )
    const productIdMap = new Map<number, string>()
    for (const row of productMapResult.rows) {
      productIdMap.set(row.old_id, row.new_id)
    }
    console.log(`   Loaded ${productIdMap.size} product mappings`)

    // Step 3: Insert images into PostgreSQL
    console.log('\n💾 Inserting images into PostgreSQL...')

    let inserted = 0
    let skippedNoProduct = 0
    const thumbnailUpdates = new Map<string, string>() // newProductId → primary image url

    for (const oldImg of oldImages) {
      const newId = generateUUIDFromId('product_images', oldImg.id)
      const productNewId = productIdMap.get(oldImg.product_id)

      if (!productNewId) {
        skippedNoProduct++
        if (VERBOSE) {
          console.log(`   ⚠ Image ${oldImg.id} - product ${oldImg.product_id} not found, skipping`)
        }
        continue
      }

      // Track primary image for thumbnail update
      if (oldImg.is_primary && !thumbnailUpdates.has(productNewId)) {
        thumbnailUpdates.set(productNewId, oldImg.image_url)
      }

      const metadata: Record<string, any> = {
        oldImageId: oldImg.id,
        old_product_id: oldImg.product_id,
        design_name: oldImg.design_name,
        sku: oldImg.sku,
        alt_text: oldImg.alt_text,
        is_primary: Boolean(oldImg.is_primary),
        stock_quantity: oldImg.stock_quantity,
        uploaded_by: oldImg.uploaded_by,
        use_youtube_sku: Boolean(oldImg.use_youtube_sku),
        version: oldImg.version,
      }

      try {
        await pgClient.query(
          `INSERT INTO image (id, url, rank, product_id, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            newId,
            oldImg.image_url,
            oldImg.sort_order,
            productNewId,
            JSON.stringify(metadata),
            oldImg.created_at,
            oldImg.upload_date,
          ]
        )

        // Save ID mapping
        await pgClient.query(
          `INSERT INTO migration_id_map (old_table, old_id, new_table, new_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (old_table, old_id) DO NOTHING`,
          ['product_images', oldImg.id, 'image', newId]
        )

        inserted++
        if (VERBOSE && inserted % 100 === 0) {
          console.log(`   ... ${inserted} images inserted`)
        }
      } catch (error: any) {
        console.error(`   ✗ Failed to insert image ${oldImg.id}:`, error.message)
        throw error
      }
    }

    console.log(`   ✅ Inserted ${inserted} of ${oldImages.length} images`)
    if (skippedNoProduct > 0) {
      console.log(`   ⚠️  Skipped ${skippedNoProduct} images (product not found)`)
    }

    // Step 4: Update product thumbnails
    console.log(`\n🖼️  Updating product thumbnails (${thumbnailUpdates.size} products)...`)
    let thumbnailsSet = 0
    for (const [productId, imageUrl] of thumbnailUpdates) {
      try {
        await pgClient.query(
          `UPDATE product SET thumbnail = $1 WHERE id = $2`,
          [imageUrl, productId]
        )
        thumbnailsSet++
      } catch (error: any) {
        console.error(`   ⚠ Failed to set thumbnail for product ${productId}:`, error.message)
      }
    }
    console.log(`   ✅ Set thumbnails for ${thumbnailsSet} products`)

    // Step 5: Verify migration
    console.log('\n✅ Image migration completed!')

    const imageCount = await pgClient.query('SELECT COUNT(*) as count FROM image')
    console.log(`   Total images in PostgreSQL: ${imageCount.rows[0].count}`)

    const thumbCount = await pgClient.query(
      `SELECT COUNT(*) as count FROM product WHERE thumbnail IS NOT NULL`
    )
    console.log(`   Products with thumbnails: ${thumbCount.rows[0].count}`)

    // Images per product stats
    const statsResult = await pgClient.query(`
      SELECT
        MIN(cnt) as min_images,
        MAX(cnt) as max_images,
        ROUND(AVG(cnt)) as avg_images
      FROM (SELECT product_id, COUNT(*) as cnt FROM image GROUP BY product_id) sub
    `)
    const stats = statsResult.rows[0]
    console.log(`   Images per product: min=${stats.min_images}, max=${stats.max_images}, avg=${stats.avg_images}`)

    const mappingCount = await pgClient.query(
      `SELECT COUNT(*) as count FROM migration_id_map WHERE old_table = 'product_images'`
    )
    console.log(`   ID mappings saved: ${mappingCount.rows[0].count}`)

  } catch (error) {
    console.error('\n❌ Image migration failed:', error)
    throw error
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('================================================================================')
  console.log('SCRIPT 04: Migrate Product Images')
  console.log('================================================================================')

  let mysqlConnection: any = null
  let pgClient: PgClient | null = null

  try {
    console.log('\n🔗 Connecting to databases...')
    mysqlConnection = await connectMySQL()
    pgClient = await connectPostgreSQL()
    console.log('   ✅ Connected to MySQL')
    console.log('   ✅ Connected to PostgreSQL')

    // Verify script 03 ran (products must exist)
    const prodCount = await pgClient.query('SELECT COUNT(*) as count FROM product')
    if (parseInt(prodCount.rows[0].count) === 0) {
      console.error('\n❌ No products found in PostgreSQL. Run script:03 first!')
      process.exit(1)
    }
    console.log(`   ✅ Found ${prodCount.rows[0].count} products (script:03 completed)`)

    await migrateImages(mysqlConnection, pgClient)

    console.log('\n================================================================================')
    console.log('✅ IMAGE MIGRATION COMPLETE')
    console.log('================================================================================\n')
    console.log('Next step: Run Script 05 (migrate variants & stock)')
    console.log('  npm run script:05\n')

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED')
    process.exit(1)
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end()
    }
    if (pgClient) {
      await pgClient.end()
    }
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}

export { migrateImages }
