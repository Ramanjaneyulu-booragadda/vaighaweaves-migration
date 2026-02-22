/**
 * Admin API: Image Optimizer
 *
 * POST /admin/image-optimizer/process  — Reprocess a single image
 * POST /admin/image-optimizer/upload   — Upload new image with responsive sizes
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IMAGE_OPTIMIZER_MODULE } from "../../../modules/image-optimizer"

/**
 * POST /admin/image-optimizer
 *
 * Reprocess a single existing image by its Medusa image_id.
 * Downloads from existing URL, generates responsive sizes, uploads to S3.
 *
 * Body: { image_id: string, product_id: string, source_url: string }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const imageService = req.scope.resolve(IMAGE_OPTIMIZER_MODULE)
  const { image_id, product_id, source_url } = req.body as Record<string, string>

  if (!image_id || !product_id || !source_url) {
    return res.status(400).json({
      message: "image_id, product_id, and source_url are required",
    })
  }

  try {
    const result = await imageService.processFromUrl(source_url, product_id, image_id)
    return res.json({
      image_id,
      product_id,
      variants: result.variants,
    })
  } catch (err: any) {
    return res.status(500).json({
      message: `Image processing failed: ${err.message}`,
    })
  }
}

/**
 * GET /admin/image-optimizer
 *
 * List image variants for a given image or product.
 *
 * Query: ?image_id= or ?image_ids=id1,id2,id3
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const imageService = req.scope.resolve(IMAGE_OPTIMIZER_MODULE)
  const { image_id, image_ids } = req.query as Record<string, string>

  if (image_id) {
    const variants = await imageService.getVariantsForImage(image_id)
    return res.json({ variants })
  }

  if (image_ids) {
    const ids = image_ids.split(",").map((s: string) => s.trim())
    const grouped = await imageService.getVariantsForImages(ids)
    // Convert Map to plain object for JSON serialization
    const result: Record<string, unknown[]> = {}
    for (const [key, value] of grouped.entries()) {
      result[key] = value
    }
    return res.json({ variants_by_image: result })
  }

  return res.status(400).json({ message: "image_id or image_ids query param required" })
}
