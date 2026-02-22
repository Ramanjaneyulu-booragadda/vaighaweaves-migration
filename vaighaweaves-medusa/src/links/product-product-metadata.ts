/**
 * Link: Product ↔ ProductMetadata (1:1)
 *
 * Associates each Medusa product with its VaighaWeaves-specific metadata
 * (brand, fabric, occasion, etc.) stored in the product_metadata table.
 *
 * Medusa auto-creates and manages the link table. After adding this file,
 * run `npx medusa db:migrate` to create the link table in PostgreSQL.
 */
import ProductModule from "@medusajs/medusa/product"
import ProductMetadataModule from "../modules/product-metadata"
import { defineLink } from "@medusajs/framework/utils"

export default defineLink(
  ProductModule.linkable.product,
  ProductMetadataModule.linkable.productMetadata
)
