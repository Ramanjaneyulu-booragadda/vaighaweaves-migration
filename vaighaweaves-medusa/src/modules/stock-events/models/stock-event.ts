/**
 * StockEvent model — append-only audit ledger for all stock movements.
 *
 * Every change to inventory (reservation, release, sale, restock, admin
 * adjustment) writes one immutable row here. Current stock = Medusa's
 * inventory_level.stocked_quantity; this table is the "why" behind each change.
 *
 * Maps to the `stock_event` table created by data-migration script 01.
 */
import { model } from "@medusajs/framework/utils"

/** All possible event types that can mutate stock. */
export const StockEventType = {
  /** Stock reserved when an order is placed (quantity temporarily locked). */
  RESERVED: "RESERVED",
  /** Reservation released when an order is cancelled. */
  RELEASED: "RELEASED",
  /** Stock permanently consumed when an order ships / is fulfilled. */
  SOLD: "SOLD",
  /** Stock added via restocking (purchase order received). */
  RESTOCKED: "RESTOCKED",
  /** Manual admin adjustment (damaged goods, write-offs, corrections). */
  ADJUSTED: "ADJUSTED",
} as const

export type StockEventTypeValue =
  (typeof StockEventType)[keyof typeof StockEventType]

const StockEvent = model.define("stock_event", {
  id: model.id().primaryKey(),

  /** Medusa product_variant.id — nullable for store-wide events. */
  variant_id: model.text().nullable(),

  /** Medusa order.id — null for manual admin adjustments or restocks. */
  order_id: model.text().nullable(),

  /** One of the StockEventType values above. Stored as plain TEXT for
   *  forward-compatibility (no enum constraint in DB). */
  event_type: model.text(),

  /**
   * Net stock delta applied by this event.
   *  - Negative for RESERVED / SOLD (stock consumed)
   *  - Positive for RELEASED / RESTOCKED / ADJUSTED (stock returned/added)
   */
  quantity_change: model.number(),

  /**
   * Snapshot of stocked_quantity AFTER this event was applied.
   * Useful for replaying the audit trail without re-joining inventory_level.
   */
  new_quantity: model.number(),

  /** Human-readable explanation (e.g. "Order ord-xyz cancelled by admin"). */
  reason: model.text().nullable(),

  /** ID of the Medusa user or customer who triggered the change (if known). */
  created_by: model.text().nullable(),
})

export default StockEvent
