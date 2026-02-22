/**
 * ProductMetadata model — custom product fields for VaighaWeaves.
 *
 * Stores saree-specific attributes (fabric, occasion, material) alongside
 * business fields (brand, compare_price, is_featured) that were previously
 * embedded in the Medusa product.metadata JSONB column.
 *
 * Linked 1:1 to Medusa's product via defineLink in src/links/.
 * Maps to the `product_metadata` table.
 */
import { model } from "@medusajs/framework/utils"

const ProductMetadata = model.define("product_metadata", {
  id: model.id().primaryKey(),

  // ── Existing fields (migrated from product.metadata JSONB) ──────────────
  brand: model.text().nullable(),
  tags: model.text().nullable(),
  is_featured: model.boolean().default(false),
  compare_price: model.number().nullable(),
  cost_price: model.number().nullable(),
  low_stock_threshold: model.number().default(10),
  minimum_order_quantity: model.number().default(1),
  measuring_unit: model.text().nullable(),
  measuring_unit_name: model.text().nullable(),
  weight_unit: model.text().default("kg"),
  meta_title: model.text().nullable(),
  meta_description: model.text().nullable(),
  view_count: model.number().default(0),

  // ── New saree-specific fields ───────────────────────────────────────────
  fabric: model.text().nullable(),
  occasion: model.text().nullable(),
  material: model.text().nullable(),
  color: model.text().nullable(),
  pattern: model.text().nullable(),
  care_instructions: model.text().nullable(),
})

export default ProductMetadata
