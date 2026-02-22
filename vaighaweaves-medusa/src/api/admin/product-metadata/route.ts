/**
 * Admin API: Product Metadata
 *
 * GET  /admin/product-metadata  — List metadata with optional filters
 * POST /admin/product-metadata  — Upsert metadata for a product
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_METADATA_MODULE } from "../../../modules/product-metadata"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/product-metadata
 *
 * Query params:
 *   ?product_id=    — filter by linked product
 *   ?is_featured=   — "true" or "false"
 *   ?fabric=        — filter by fabric type
 *   ?occasion=      — filter by occasion
 *   ?limit=         — pagination (default 50)
 *   ?offset=        — pagination (default 0)
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const metadataService = req.scope.resolve(PRODUCT_METADATA_MODULE)
  const { product_id, is_featured, fabric, occasion, limit, offset } =
    req.query as Record<string, string | undefined>

  // If filtering by product_id, query through the link table
  if (product_id) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "product_metadata.*"],
      filters: { id: product_id },
    })

    const metadata = data?.[0]?.product_metadata
    return res.json({ product_metadata: metadata ? [metadata] : [] })
  }

  // Otherwise, filter directly on product_metadata table
  const filters: Record<string, unknown> = {}
  if (is_featured === "true") filters.is_featured = true
  if (is_featured === "false") filters.is_featured = false
  if (fabric) filters.fabric = fabric
  if (occasion) filters.occasion = occasion

  const records = await metadataService.listProductMetadatas(filters, {
    take: Number(limit) || 50,
    skip: Number(offset) || 0,
  })

  return res.json({ product_metadata: records })
}

/**
 * POST /admin/product-metadata
 *
 * Body:
 *   { product_id: string, ...fields }
 *
 * Creates or updates product metadata. If a metadata record already exists
 * for the given product (via link table), it updates. Otherwise, creates
 * a new record and link.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const metadataService = req.scope.resolve(PRODUCT_METADATA_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { product_id, ...fields } = req.body as Record<string, unknown>

  if (!product_id || typeof product_id !== "string") {
    return res.status(400).json({ message: "product_id is required" })
  }

  // Check if metadata already exists for this product
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "product_metadata.id"],
    filters: { id: product_id },
  })

  const existingMetadataId = data?.[0]?.product_metadata?.id

  const result = await metadataService.upsertForProduct(
    existingMetadataId || null,
    fields
  )

  // If we created a new record, we need to create the link
  if (!existingMetadataId && result?.id) {
    const link = req.scope.resolve(ContainerRegistrationKeys.LINK)
    await link.create({
      productService: { product_id },
      productMetadata: { product_metadata_id: result.id },
    })
  }

  return res.json({ product_metadata: result })
}
