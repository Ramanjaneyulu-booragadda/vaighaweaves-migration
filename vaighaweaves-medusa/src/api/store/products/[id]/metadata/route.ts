/**
 * Store API: Product Metadata
 *
 * GET /store/products/:id/metadata — Public endpoint for frontend
 *
 * Returns product metadata (brand, fabric, occasion, etc.) for rendering
 * on the product detail page. No authentication required.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "product_metadata.*",
    ],
    filters: { id },
  })

  const product = data?.[0]
  if (!product?.product_metadata) {
    return res.status(404).json({ message: "Product metadata not found" })
  }

  return res.json({ product_metadata: product.product_metadata })
}
