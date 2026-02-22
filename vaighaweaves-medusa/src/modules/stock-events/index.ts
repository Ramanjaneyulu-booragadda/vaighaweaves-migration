/**
 * stock-events Medusa module definition.
 *
 * Registered in medusa-config.ts under the key "stockEvents".
 * Resolve from the container anywhere in the app:
 *
 *   import { STOCK_EVENTS_MODULE } from "../modules/stock-events"
 *   const stockService = container.resolve(STOCK_EVENTS_MODULE)
 */
import { Module } from "@medusajs/framework/utils"
import StockEventModuleService from "./service"

export const STOCK_EVENTS_MODULE = "stockEvents"

export default Module(STOCK_EVENTS_MODULE, {
  service: StockEventModuleService,
})
