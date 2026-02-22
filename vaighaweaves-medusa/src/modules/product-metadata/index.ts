/**
 * product-metadata Medusa module definition.
 *
 * Registered in medusa-config.ts under the key "productMetadata".
 * Resolve from the container anywhere in the app:
 *
 *   import { PRODUCT_METADATA_MODULE } from "../modules/product-metadata"
 *   const metadataService = container.resolve(PRODUCT_METADATA_MODULE)
 */
import { Module } from "@medusajs/framework/utils"
import ProductMetadataModuleService from "./service"

export const PRODUCT_METADATA_MODULE = "productMetadata"

export default Module(PRODUCT_METADATA_MODULE, {
  service: ProductMetadataModuleService,
})
