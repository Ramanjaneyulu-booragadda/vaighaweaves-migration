/**
 * ImageOptimizerModuleService
 *
 * Generates responsive image sizes using Sharp, uploads to S3, and tracks
 * variants in the image_variant table.
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 * 1. Lazy S3 client — only initialized on first use (testable without creds).
 * 2. Pure processing — Sharp resize is a pure function, tested independently.
 * 3. Module-scoped — stores results in image_variant table; does not write to
 *    Medusa's core image table directly.
 */
import { MedusaService } from "@medusajs/framework/utils"
import ImageVariant from "./models/image-variant"

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const IMAGE_SIZES = {
  thumb: { width: 150, height: 200 },
  sm: { width: 400, height: 533 },
  md: { width: 800, height: 1067 },
  lg: { width: 1200, height: 1600 },
} as const

export type SizeName = keyof typeof IMAGE_SIZES
export const QUALITY = 85
export const FORMAT = "webp" as const

export interface SizedImage {
  size: SizeName
  buffer: Buffer
  width: number
  height: number
  format: string
}

export interface VariantRecord {
  size: string
  url: string
  s3_key: string
  width: number
  height: number
  format: string
  file_size: number
}

export interface ProcessResult {
  variants: VariantRecord[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

class ImageOptimizerModuleService extends MedusaService({
  ImageVariant,
}) {
  private s3Client: any = null
  private bucketName: string = ""
  private cloudfrontDomain: string = ""

  /** Lazy-init S3 client from env vars. */
  private getS3Config() {
    if (!this.s3Client) {
      const { S3Client } = require("@aws-sdk/client-s3")
      this.bucketName = process.env.AWS_S3_BUCKET_NAME || ""
      this.cloudfrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN || ""
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || "ap-south-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        },
      })
    }
    return { client: this.s3Client, bucket: this.bucketName, cdn: this.cloudfrontDomain }
  }

  /**
   * Generate responsive sizes from an image buffer.
   * Pure function — no side effects.
   */
  async generateSizes(buffer: Buffer): Promise<SizedImage[]> {
    const sharp = require("sharp")
    const metadata = await sharp(buffer).metadata()
    const originalWidth = metadata.width || 1200
    const originalHeight = metadata.height || 1600

    const results: SizedImage[] = []

    for (const [sizeName, dims] of Object.entries(IMAGE_SIZES)) {
      // Skip sizes larger than original
      if (dims.width > originalWidth) continue

      const resized = await sharp(buffer)
        .resize(dims.width, dims.height, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer()

      const resizedMeta = await sharp(resized).metadata()

      results.push({
        size: sizeName as SizeName,
        buffer: resized,
        width: resizedMeta.width || dims.width,
        height: resizedMeta.height || dims.height,
        format: FORMAT,
      })
    }

    return results
  }

  /**
   * Upload a buffer to S3 and return the CloudFront URL.
   */
  async uploadToS3(buffer: Buffer, key: string, contentType: string): Promise<string> {
    const { Upload } = require("@aws-sdk/lib-storage")
    const { client, bucket, cdn } = this.getS3Config()

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

  /**
   * Generate S3 key for an image variant.
   */
  generateS3Key(
    productId: string,
    imageId: string,
    sizeName: string,
    format: string
  ): string {
    return `products/${productId}/${imageId}-${sizeName}.${format}`
  }

  /**
   * Process an image buffer: generate all responsive sizes, upload to S3,
   * and store ImageVariant records.
   */
  async processAndUpload(
    buffer: Buffer,
    productId: string,
    imageId: string
  ): Promise<ProcessResult> {
    const sizes = await this.generateSizes(buffer)
    const variants: VariantRecord[] = []

    for (const sized of sizes) {
      const s3Key = this.generateS3Key(productId, imageId, sized.size, sized.format)
      const url = await this.uploadToS3(sized.buffer, s3Key, `image/${sized.format}`)

      const variantRecord: VariantRecord = {
        size: sized.size,
        url,
        s3_key: s3Key,
        width: sized.width,
        height: sized.height,
        format: sized.format,
        file_size: sized.buffer.length,
      }
      variants.push(variantRecord)

      // Store in DB
      await this.createImageVariants([
        {
          image_id: imageId,
          size: sized.size,
          url,
          s3_key: s3Key,
          width: sized.width,
          height: sized.height,
          format: sized.format,
          file_size: sized.buffer.length,
          processed_at: new Date(),
        },
      ])
    }

    return { variants }
  }

  /**
   * Download an image from a URL and process it.
   * Used for backfilling existing images.
   */
  async processFromUrl(
    sourceUrl: string,
    productId: string,
    imageId: string
  ): Promise<ProcessResult> {
    const response = await fetch(sourceUrl)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${sourceUrl}`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    return this.processAndUpload(buffer, productId, imageId)
  }

  /**
   * Get all variants for a single image.
   */
  async getVariantsForImage(imageId: string): Promise<Record<string, unknown>[]> {
    return this.listImageVariants({ image_id: imageId })
  }

  /**
   * Batch lookup: return variants grouped by image ID.
   */
  async getVariantsForImages(
    imageIds: string[]
  ): Promise<Map<string, Record<string, unknown>[]>> {
    const allVariants = await this.listImageVariants({
      image_id: imageIds,
    })

    const grouped = new Map<string, Record<string, unknown>[]>()
    for (const v of allVariants) {
      const imgId = v.image_id as string
      if (!grouped.has(imgId)) grouped.set(imgId, [])
      grouped.get(imgId)!.push(v)
    }
    return grouped
  }
}

export default ImageOptimizerModuleService
