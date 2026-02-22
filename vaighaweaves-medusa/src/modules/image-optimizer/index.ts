/**
 * image-optimizer Medusa module definition.
 *
 * Registered in medusa-config.ts under the key "imageOptimizer".
 * Resolve from the container anywhere in the app:
 *
 *   import { IMAGE_OPTIMIZER_MODULE } from "../modules/image-optimizer"
 *   const imageService = container.resolve(IMAGE_OPTIMIZER_MODULE)
 */
import { Module } from "@medusajs/framework/utils"
import ImageOptimizerModuleService from "./service"

export const IMAGE_OPTIMIZER_MODULE = "imageOptimizer"

export default Module(IMAGE_OPTIMIZER_MODULE, {
  service: ImageOptimizerModuleService,
})
