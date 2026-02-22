/**
 * ImageVariant model — tracks responsive image sizes generated from originals.
 *
 * Each image (from Medusa's `image` table) can have multiple ImageVariant
 * records: thumb (150px), sm (400px), md (800px), lg (1200px), and original.
 *
 * Maps to the `image_variant` table.
 */
import { model } from "@medusajs/framework/utils"

const ImageVariant = model.define("image_variant", {
  id: model.id().primaryKey(),

  /** Medusa image.id — references the source image (by convention, not FK). */
  image_id: model.text(),

  /** Size label: "thumb", "sm", "md", "lg", "original" */
  size: model.text(),

  /** Full CloudFront/S3 URL for this variant. */
  url: model.text(),

  /** S3 object key (e.g., "products/prod-123/image-thumb.webp"). */
  s3_key: model.text(),

  /** Pixel dimensions of this variant. */
  width: model.number(),
  height: model.number(),

  /** Image format: "webp", "avif", "jpeg", "png". */
  format: model.text(),

  /** File size in bytes (null if not tracked). */
  file_size: model.number().nullable(),

  /** When this variant was generated. */
  processed_at: model.dateTime().nullable(),
})

export default ImageVariant
