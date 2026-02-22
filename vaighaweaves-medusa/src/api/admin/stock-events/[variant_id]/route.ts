/**
 * Admin API: /admin/stock-events/:variant_id
 *
 * GET — Full stock audit trail for a single variant.
 *       Returns events in reverse-chronological order.
 *
 * Example:
 *   GET /admin/stock-events/variant_01J8...
 *   → { variant_id, events: [...], count: 12 }
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { STOCK_EVENTS_MODULE } from "../../../../modules/stock-events"
import StockEventModuleService from "../../../../modules/stock-events/service"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const stockService: StockEventModuleService = req.scope.resolve(
    STOCK_EVENTS_MODULE
  )

  const { variant_id } = req.params

  const events = await stockService.getStockHistory(variant_id)

  res.json({
    variant_id,
    events,
    count: events.length,
  })
}
