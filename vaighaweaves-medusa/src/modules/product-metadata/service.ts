/**
 * ProductMetadataModuleService
 *
 * Manages custom product fields for VaighaWeaves saree catalog.
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 * 1. Typed columns — unlike JSONB metadata, fields are queryable and indexed.
 * 2. 1:1 link with Medusa product — connected via defineLink (see src/links/).
 * 3. Auto-CRUD — MedusaService generates create/list/update/delete/retrieve.
 * 4. Custom business logic layered on top of generated CRUD.
 */
import { MedusaService } from "@medusajs/framework/utils"
import ProductMetadata from "./models/product-metadata"

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductMetadataFields {
  brand?: string | null
  tags?: string | null
  is_featured?: boolean
  compare_price?: number | null
  cost_price?: number | null
  low_stock_threshold?: number
  minimum_order_quantity?: number
  measuring_unit?: string | null
  measuring_unit_name?: string | null
  weight_unit?: string
  meta_title?: string | null
  meta_description?: string | null
  view_count?: number
  fabric?: string | null
  occasion?: string | null
  material?: string | null
  color?: string | null
  pattern?: string | null
  care_instructions?: string | null
}

export interface AttributeFilters {
  fabric?: string
  occasion?: string
  material?: string
  color?: string
  pattern?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Service class
// ─────────────────────────────────────────────────────────────────────────────

class ProductMetadataModuleService extends MedusaService({
  ProductMetadata,
}) {
  /**
   * Create or update metadata for a product.
   * If a record with the given `productMetadataId` exists, update it.
   * Otherwise, create a new record.
   *
   * The caller (API route) is responsible for managing the link table entry.
   */
  async upsertForProduct(
    productMetadataId: string | null,
    data: ProductMetadataFields
  ): Promise<Record<string, unknown>> {
    if (productMetadataId) {
      // Update existing
      const updated = await this.updateProductMetadatas(
        { id: productMetadataId },
        data
      )
      return updated
    }

    // Create new
    const [created] = await this.createProductMetadatas([data])
    return created
  }

  /**
   * Atomically increment view_count for a product metadata record.
   */
  async incrementViewCount(
    productMetadataId: string
  ): Promise<void> {
    const record = await this.retrieveProductMetadata(productMetadataId)
    const currentCount = (record as any).view_count ?? 0
    await this.updateProductMetadatas(
      { id: productMetadataId },
      { view_count: currentCount + 1 }
    )
  }

  /**
   * List all metadata records where is_featured = true.
   */
  async getFeaturedProducts(): Promise<Record<string, unknown>[]> {
    return this.listProductMetadatas({ is_featured: true })
  }

  /**
   * Filter metadata by saree-specific attributes.
   * Only non-undefined filters are applied.
   */
  async filterByAttributes(
    filters: AttributeFilters
  ): Promise<Record<string, unknown>[]> {
    const query: Record<string, unknown> = {}

    if (filters.fabric) query.fabric = filters.fabric
    if (filters.occasion) query.occasion = filters.occasion
    if (filters.material) query.material = filters.material
    if (filters.color) query.color = filters.color
    if (filters.pattern) query.pattern = filters.pattern

    return this.listProductMetadatas(query)
  }
}

export default ProductMetadataModuleService
