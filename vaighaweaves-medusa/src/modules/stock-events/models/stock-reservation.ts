/**
 * StockReservation model — tracks temporarily held stock.
 *
 * Used for three scenarios:
 *   1. Online orders (status: ACTIVE → FULFILLED when shipped)
 *   2. Phone bookings (status: ACTIVE → expires unless confirmed)
 *   3. Walk-in holds (short expiry, customer name/phone stored)
 *
 * Maps to the `stock_reservation` table created by data-migration script 01,
 * which already contains 1,049 migrated records.
 */
import { model } from "@medusajs/framework/utils"

export const ReservationStatus = {
  ACTIVE: "ACTIVE",
  FULFILLED: "FULFILLED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const

export type ReservationStatusValue =
  (typeof ReservationStatus)[keyof typeof ReservationStatus]

export const ReservationType = {
  ONLINE: "ONLINE",
  PHONE: "PHONE",
  WALKIN: "WALKIN",
} as const

export type ReservationTypeValue =
  (typeof ReservationType)[keyof typeof ReservationType]

const StockReservation = model.define("stock_reservation", {
  id: model.id().primaryKey(),

  /** Medusa product_variant.id — required, stock is reserved per variant. */
  variant_id: model.text(),

  /** Medusa order.id — null for phone/walk-in holds not yet linked to an order. */
  order_id: model.text().nullable(),

  /** Medusa customer.id (registered customers). */
  customer_id: model.text().nullable(),

  /** Medusa user.id (staff member who created a phone/walk-in reservation). */
  staff_id: model.text().nullable(),

  /** Number of units held. */
  quantity: model.number(),

  /**
   * Lifecycle state. See ReservationStatus.
   * Stored as TEXT rather than a DB enum for easy extension.
   */
  status: model.text(),

  /** When null, the reservation never expires automatically. */
  expiry_at: model.dateTime().nullable(),

  /** Channel that created this reservation. See ReservationType. */
  reservation_type: model.text(),

  // ── Walk-in / phone-booking metadata (null for online orders) ──────────────

  /** Customer display name for walk-in / phone bookings. */
  customer_name: model.text().nullable(),

  /** Customer phone for walk-in / phone bookings. */
  customer_phone: model.text().nullable(),

  /** Free-text staff notes (e.g. "Customer will collect Saturday"). */
  notes: model.text().nullable(),
})

export default StockReservation
