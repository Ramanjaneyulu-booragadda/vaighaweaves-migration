/**
 * Subscriber: order.placed
 *
 * When a customer places an order, log a RESERVED stock event for every
 * line item and create the matching StockReservation record.
 *
 * ARCHITECTURE NOTE
 * ─────────────────
 * Medusa's built-in InventoryModule handles the actual `stocked_quantity`
 * deduction (via its own internal hooks). This subscriber adds the
 * VaighaWeaves audit layer on top:
 *   - StockReservation row  → "what is on hold"
 *   - StockEvent (RESERVED) → "why and when"
 *
 * CONCURRENCY PROTECTION (Phase 1.3b)
 * ────────────────────────────────────
 * Each line item is wrapped in a PostgreSQL advisory lock keyed by
 * `stock:<variant_id>`. This serialises all stock mutations for a given
 * variant, preventing:
 *   - Overselling (two concurrent orders both seeing sufficient stock)
 *   - Duplicate reservations (Medusa retrying the order.placed event)
 *
 * The idempotency check (listStockReservations before reserving) combined
 * with the lock ensures at-most-once reservation semantics.
 *
 * This subscriber must NEVER throw — a failure here must not block the order.
 */
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { STOCK_EVENTS_MODULE } from "../modules/stock-events"
import StockEventModuleService from "../modules/stock-events/service"
import { getVariantStock } from "../modules/stock-events/utils"

interface OrderPlacedEventData {
  id: string
}

export default async function handleOrderPlaced({
  event: { data },
  container,
}: SubscriberArgs<OrderPlacedEventData>): Promise<void> {
  const orderId = data.id

  try {
    const stockService: StockEventModuleService =
      container.resolve(STOCK_EVENTS_MODULE)

    const orderModule = container.resolve(Modules.ORDER)
    const inventoryModule = container.resolve(Modules.INVENTORY)
    const lockingModule = container.resolve(Modules.LOCKING)

    // Fetch the full order with line items
    const order = await orderModule.retrieveOrder(orderId, {
      relations: ["items"],
    })

    for (const item of order.items ?? []) {
      if (!item.variant_id) continue

      const variantId = item.variant_id

      await lockingModule.execute(
        `stock:${variantId}`,
        async () => {
          // ── Idempotency check — skip if already reserved for this order ──
          const existing = await stockService.listStockReservations({
            order_id: orderId,
            variant_id: variantId,
            status: "ACTIVE",
          })
          if (existing.length > 0) {
            console.log(
              `[stock-events] Skipping duplicate reservation for order ${orderId} variant ${variantId}`
            )
            return
          }

          // ── Fetch fresh stock INSIDE the lock to avoid stale reads ───────
          const currentStock = await getVariantStock(
            inventoryModule,
            item.variant_sku ?? undefined
          )

          // ── Reserve stock (creates both reservation + event row) ─────────
          await stockService.reserveStock(
            variantId,
            item.quantity,
            currentStock,
            {
              orderId: order.id,
              customerId: order.customer_id ?? undefined,
              reservationType: "ONLINE",
            }
          )
        },
        { timeout: 5 }
      )
    }
  } catch (err) {
    // Log but never re-throw — this must not break order processing
    console.error(
      `[stock-events] order.placed handler failed for order ${orderId}:`,
      err
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
