/**
 * Subscriber: order.cancelled
 *
 * When an order is cancelled, release the reserved stock back to available
 * inventory. Logs a RELEASED stock event and marks the reservation CANCELLED.
 *
 * CONCURRENCY PROTECTION (Phase 1.3b)
 * ────────────────────────────────────
 * Same advisory-lock pattern as order-placed.ts: each variant is locked while
 * we check idempotency and release. Prevents:
 *   - Double-release if the event fires twice (Medusa retry)
 *   - Lost updates from concurrent release + fulfillment on the same reservation
 *
 * Same resilience policy as order-placed.ts: never throw, always log.
 */
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { STOCK_EVENTS_MODULE } from "../modules/stock-events"
import StockEventModuleService from "../modules/stock-events/service"
import { getVariantStock } from "../modules/stock-events/utils"

interface OrderCancelledEventData {
  id: string
}

export default async function handleOrderCancelled({
  event: { data },
  container,
}: SubscriberArgs<OrderCancelledEventData>): Promise<void> {
  const orderId = data.id

  try {
    const stockService: StockEventModuleService =
      container.resolve(STOCK_EVENTS_MODULE)

    const orderModule = container.resolve(Modules.ORDER)
    const inventoryModule = container.resolve(Modules.INVENTORY)
    const lockingModule = container.resolve(Modules.LOCKING)

    const order = await orderModule.retrieveOrder(orderId, {
      relations: ["items"],
    })

    for (const item of order.items ?? []) {
      if (!item.variant_id) continue

      const variantId = item.variant_id

      await lockingModule.execute(
        `stock:${variantId}`,
        async () => {
          // ── Idempotency check — skip if reservation is already CANCELLED ──
          const stillActive = await stockService.listStockReservations({
            order_id: orderId,
            variant_id: variantId,
            status: "ACTIVE",
          })
          if (stillActive.length === 0) {
            console.log(
              `[stock-events] Skipping duplicate release for order ${orderId} variant ${variantId} — no ACTIVE reservation found`
            )
            return
          }

          // ── Fetch fresh stock INSIDE the lock (post-cancellation) ────────
          const currentStock = await getVariantStock(
            inventoryModule,
            item.variant_sku ?? undefined
          )

          // ── Release the reservation ──────────────────────────────────────
          await stockService.releaseStock(
            variantId,
            item.quantity,
            currentStock,
            {
              orderId: order.id,
              reason: `Order ${order.id} cancelled`,
            }
          )
        },
        { timeout: 5 }
      )
    }
  } catch (err) {
    console.error(
      `[stock-events] order.cancelled handler failed for order ${orderId}:`,
      err
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.cancelled",
}
