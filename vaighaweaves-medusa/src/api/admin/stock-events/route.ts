/**
 * Admin API: /admin/stock-events
 *
 * GET  /admin/stock-events           — List stock events (filterable)
 * POST /admin/stock-events           — Manual stock adjustment by admin
 *
 * Query params for GET:
 *   ?variant_id=var_xxx              — filter by variant (most common)
 *   ?event_type=ADJUSTED             — filter by event type
 *   ?limit=50&offset=0               — pagination
 *
 * Request body for POST:
 *   { variant_id, variant_sku, delta, reason }
 *
 *   `variant_sku` is optional — when provided, current stock is fetched
 *   fresh from the inventory module inside the advisory lock (safe).
 *   When omitted the endpoint still acquires the lock before writing.
 *
 * Protected by Medusa's built-in admin JWT middleware.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { STOCK_EVENTS_MODULE } from "../../../modules/stock-events"
import StockEventModuleService from "../../../modules/stock-events/service"
import { getVariantStock } from "../../../modules/stock-events/utils"

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/stock-events
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const stockService: StockEventModuleService = req.scope.resolve(
    STOCK_EVENTS_MODULE
  )

  const { variant_id, event_type, limit = "50", offset = "0" } = req.query as {
    variant_id?: string
    event_type?: string
    limit?: string
    offset?: string
  }

  // Build filter object — only include defined fields
  const filters: Record<string, unknown> = {}
  if (variant_id) filters.variant_id = variant_id
  if (event_type) filters.event_type = event_type

  const events = await stockService.listStockEvents(filters, {
    take: parseInt(limit, 10),
    skip: parseInt(offset, 10),
    order: { created_at: "DESC" } as Record<string, "ASC" | "DESC">,
  } as Parameters<typeof stockService.listStockEvents>[1])

  res.json({
    stock_events: events,
    count: events.length,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/stock-events
// Manual admin stock adjustment (restock, write-off, correction)
// ─────────────────────────────────────────────────────────────────────────────
interface AdjustStockBody {
  variant_id: string
  /**
   * Optional: variant SKU used to fetch fresh stock from the inventory module
   * inside the advisory lock. When omitted the lock is still acquired but the
   * result `new_quantity` in the response is omitted.
   */
  variant_sku?: string
  /** Positive = add stock, negative = remove stock */
  delta: number
  reason: string
}

export async function POST(
  req: MedusaRequest<AdjustStockBody>,
  res: MedusaResponse
): Promise<void> {
  const stockService: StockEventModuleService = req.scope.resolve(
    STOCK_EVENTS_MODULE
  )

  const { variant_id, variant_sku, delta, reason } = req.body

  if (!variant_id || delta === undefined || !reason) {
    res.status(400).json({
      message: "Required fields: variant_id, delta, reason",
    })
    return
  }

  // Get admin user id from the authenticated session
  const adminId = (req as any).auth?.actor_id ?? "unknown-admin"

  // Resolve modules needed inside the lock
  const lockingModule = req.scope.resolve(Modules.LOCKING)
  const inventoryModule = req.scope.resolve(Modules.INVENTORY)

  let newQuantity: number | undefined

  // ── Acquire advisory lock for this variant before mutating ──────────────
  await lockingModule.execute(
    `stock:${variant_id}`,
    async () => {
      // Fetch fresh currentStock INSIDE the lock (don't trust the request body)
      const currentStock = await getVariantStock(inventoryModule, variant_sku)

      await stockService.adjustStock(
        variant_id,
        delta,
        currentStock,
        reason,
        adminId
      )

      newQuantity = currentStock + delta
    },
    { timeout: 5 }
  )

  const responseBody: Record<string, unknown> = {
    message: "Stock adjustment recorded",
    variant_id,
    delta,
    reason,
  }
  if (newQuantity !== undefined) {
    responseBody.new_quantity = newQuantity
  }

  res.status(201).json(responseBody)
}
