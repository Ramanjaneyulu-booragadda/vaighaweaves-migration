/**
 * Admin API: /admin/stock-reservations
 *
 * GET — List reservations with optional filters.
 *
 * Query params:
 *   ?variant_id=var_xxx              — filter by variant
 *   ?status=ACTIVE                   — filter by status (ACTIVE, FULFILLED, CANCELLED, EXPIRED)
 *   ?reservation_type=PHONE          — filter by type (ONLINE, PHONE, WALKIN)
 *   ?limit=50&offset=0               — pagination
 *
 * Use-cases for admin:
 *   1. See all pending phone/walk-in reservations today
 *   2. Check which variants have active holds before restocking
 *   3. Review expired reservations for stock reconciliation
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { STOCK_EVENTS_MODULE } from "../../../modules/stock-events"
import StockEventModuleService from "../../../modules/stock-events/service"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const stockService: StockEventModuleService = req.scope.resolve(
    STOCK_EVENTS_MODULE
  )

  const {
    variant_id,
    status,
    reservation_type,
    limit = "50",
    offset = "0",
  } = req.query as {
    variant_id?: string
    status?: string
    reservation_type?: string
    limit?: string
    offset?: string
  }

  const filters: Record<string, unknown> = {}
  if (variant_id) filters.variant_id = variant_id
  if (status) filters.status = status
  if (reservation_type) filters.reservation_type = reservation_type

  const reservations = await stockService.listStockReservations(filters, {
    take: parseInt(limit, 10),
    skip: parseInt(offset, 10),
    order: { created_at: "DESC" } as Record<string, "ASC" | "DESC">,
  } as Parameters<typeof stockService.listStockReservations>[1])

  res.json({
    reservations,
    count: reservations.length,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  })
}
