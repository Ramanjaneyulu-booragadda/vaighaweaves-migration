/**
 * Admin API: Product Metadata by Product ID
 *
 * GET /admin/product-metadata/:product_id — Get metadata for a specific product
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/product-metadata/:product_id
 *
 * Retrieves the product metadata linked to a specific product.
 * Returns 404 if no metadata exists.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { product_id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "product_metadata.*",
    ],
    filters: { id: product_id },
  })

  const product = data?.[0]
  if (!product) {
    return res.status(404).json({ message: "Product not found" })
  }

  if (!product.product_metadata) {
    return res.status(404).json({ message: "No metadata found for this product" })
  }

  return res.json({
    product_id: product.id,
    product_metadata: product.product_metadata,
  })
}
