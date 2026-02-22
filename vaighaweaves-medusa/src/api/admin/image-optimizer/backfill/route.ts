/**
 * Admin API: Image Optimizer Backfill
 *
 * POST /admin/image-optimizer/backfill — Trigger batch backfill
 *
 * Processes existing images from the Medusa `image` table by downloading
 * from their current URLs and generating responsive sizes.
 *
 * Body: { product_id?: string, limit?: number, offset?: number }
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IMAGE_OPTIMIZER_MODULE } from "../../../../modules/image-optimizer"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const imageService = req.scope.resolve(IMAGE_OPTIMIZER_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { product_id, limit = 50, offset = 0 } = req.body as Record<string, any>

  // Fetch images from Medusa's image table via product link
  const filters: Record<string, unknown> = {}
  if (product_id) filters.id = product_id

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "images.*"],
    filters,
    pagination: {
      take: Number(limit),
      skip: Number(offset),
    },
  })

  let processed = 0
  let failed = 0
  let skipped = 0
  const errors: string[] = []

  for (const product of products) {
    const images = (product as any).images || []
    for (const image of images) {
      if (!image.url) {
        skipped++
        continue
      }

      // Check if already processed
      const existing = await imageService.getVariantsForImage(image.id)
      if (existing.length > 0) {
        skipped++
        continue
      }

      try {
        await imageService.processFromUrl(image.url, product.id, image.id)
        processed++
      } catch (err: any) {
        failed++
        errors.push(`${image.id}: ${err.message}`)
      }
    }
  }

  return res.json({
    processed,
    failed,
    skipped,
    products_checked: products.length,
    errors: errors.slice(0, 10), // limit error details
  })
}
