/**
 * StockEventModuleService
 *
 * Core business logic for event-sourced stock management.
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 * 1. Single source of truth  — actual stock quantity lives in Medusa's
 *    inventory_level.stocked_quantity. This service never writes to that table
 *    directly; callers pass `currentStock` in so the service stays database-
 *    agnostic (and easily testable without a real DB connection).
 *
 * 2. Append-only event log — every stock change creates an immutable
 *    StockEvent row. Nothing is ever updated or deleted in that table.
 *
 * 3. Reservation lifecycle — StockReservation rows track held stock and
 *    transition through: ACTIVE → FULFILLED | CANCELLED | EXPIRED.
 *
 * 4. Separation of concerns — this service owns the audit trail and
 *    reservation table. Medusa's built-in InventoryModule owns the
 *    actual stocked_quantity. Subscribers wire the two together.
 */
import { MedusaService } from "@medusajs/framework/utils"
import StockEvent, { StockEventType } from "./models/stock-event"
import StockReservation, {
  ReservationStatus,
  ReservationType,
} from "./models/stock-reservation"

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface ReserveStockOptions {
  orderId?: string
  customerId?: string
  staffId?: string
  /** If set, the reservation auto-expires after this many minutes. */
  expiryMinutes?: number
  reservationType?: keyof typeof ReservationType
  customerName?: string
  customerPhone?: string
  notes?: string
}

export interface ReserveStockResult {
  success: boolean
  reservation?: Record<string, unknown>
  reason?: string
}

export interface ReleaseStockOptions {
  orderId?: string
  reason?: string
  staffId?: string
}

export interface ReleaseStockResult {
  success: boolean
  reason?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Service class
// ─────────────────────────────────────────────────────────────────────────────

class StockEventModuleService extends MedusaService({
  StockEvent,
  StockReservation,
}) {
  // ───────────────────────────────────────────────────────────────────────────
  // Reserve stock
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Attempt to reserve `quantity` units of a variant.
   *
   * @param variantId    Medusa product_variant.id
   * @param quantity     Units to reserve (must be > 0)
   * @param currentStock Caller-supplied current stocked_quantity
   * @param options      Optional metadata for the reservation
   *
   * @returns { success: true, reservation } on success,
   *          { success: false, reason }    when validation fails
   */
  async reserveStock(
    variantId: string,
    quantity: number,
    currentStock: number,
    options: ReserveStockOptions = {}
  ): Promise<ReserveStockResult> {
    if (quantity <= 0) {
      return { success: false, reason: "Quantity must be greater than zero" }
    }

    if (currentStock < quantity) {
      return {
        success: false,
        reason: `Insufficient stock: requested ${quantity}, available ${currentStock}`,
      }
    }

    const newStock = currentStock - quantity

    const expiryAt = options.expiryMinutes
      ? new Date(Date.now() + options.expiryMinutes * 60 * 1000)
      : null

    // 1. Create the reservation record
    const [reservation] = await this.createStockReservations([
      {
        variant_id: variantId,
        order_id: options.orderId ?? null,
        customer_id: options.customerId ?? null,
        staff_id: options.staffId ?? null,
        quantity,
        status: ReservationStatus.ACTIVE,
        expiry_at: expiryAt,
        reservation_type: options.reservationType ?? ReservationType.ONLINE,
        customer_name: options.customerName ?? null,
        customer_phone: options.customerPhone ?? null,
        notes: options.notes ?? null,
      },
    ])

    // 2. Append an immutable audit event
    await this.createStockEvents([
      {
        variant_id: variantId,
        order_id: options.orderId ?? null,
        event_type: StockEventType.RESERVED,
        quantity_change: -quantity,
        new_quantity: newStock,
        reason: `Order reserved: ${options.orderId ?? "phone/walk-in booking"}`,
        created_by: options.staffId ?? options.customerId ?? null,
      },
    ])

    return { success: true, reservation }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Release stock
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Release previously reserved stock back to available inventory.
   * Called when an order is cancelled before fulfilment.
   *
   * @param variantId    Medusa product_variant.id
   * @param quantity     Units to release (must be > 0)
   * @param currentStock Caller-supplied current stocked_quantity (before release)
   * @param options      Optional orderId, reason, staffId
   */
  async releaseStock(
    variantId: string,
    quantity: number,
    currentStock: number,
    options: ReleaseStockOptions = {}
  ): Promise<ReleaseStockResult> {
    if (quantity <= 0) {
      return { success: false, reason: "Quantity must be greater than zero" }
    }

    const newStock = currentStock + quantity

    // 1. Cancel the matching active reservation (best-effort — log even if not found)
    if (options.orderId) {
      const active = await this.listStockReservations({
        variant_id: variantId,
        order_id: options.orderId,
        status: ReservationStatus.ACTIVE,
      })

      if (active.length > 0) {
        await this.updateStockReservations(
          { id: active[0].id },
          { status: ReservationStatus.CANCELLED }
        )
      }
    }

    // 2. Append audit event
    await this.createStockEvents([
      {
        variant_id: variantId,
        order_id: options.orderId ?? null,
        event_type: StockEventType.RELEASED,
        quantity_change: quantity,
        new_quantity: newStock,
        reason: options.reason ?? "Order cancelled",
        created_by: options.staffId ?? null,
      },
    ])

    return { success: true }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Record sale
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Record final stock consumption when an order is fulfilled/shipped.
   * Transitions the reservation from ACTIVE → FULFILLED and logs a SOLD event.
   *
   * @param variantId    Medusa product_variant.id
   * @param quantity     Units sold
   * @param currentStock Caller-supplied stocked_quantity (before deduction)
   * @param orderId      Medusa order.id
   */
  async recordSale(
    variantId: string,
    quantity: number,
    currentStock: number,
    orderId: string
  ): Promise<void> {
    const newStock = currentStock - quantity

    // 1. Mark reservation as fulfilled
    const active = await this.listStockReservations({
      variant_id: variantId,
      order_id: orderId,
      status: ReservationStatus.ACTIVE,
    })

    if (active.length > 0) {
      await this.updateStockReservations(
        { id: active[0].id },
        { status: ReservationStatus.FULFILLED }
      )
    }

    // 2. Append SOLD event
    await this.createStockEvents([
      {
        variant_id: variantId,
        order_id: orderId,
        event_type: StockEventType.SOLD,
        quantity_change: -quantity,
        new_quantity: newStock,
        reason: "Order fulfilled",
        created_by: null,
      },
    ])
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Admin stock adjustment
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Manually adjust stock — used by admins for restocking, write-offs, or
   * corrections. Does NOT update Medusa's inventory directly; the caller is
   * responsible for also calling `inventoryModule.updateInventoryLevel`.
   *
   * @param variantId    Medusa product_variant.id
   * @param delta        Positive = add stock, negative = remove stock
   * @param currentStock Caller-supplied stocked_quantity (before adjustment)
   * @param reason       Mandatory explanation for the audit trail
   * @param adminId      Medusa user.id of the admin performing the action
   */
  async adjustStock(
    variantId: string,
    delta: number,
    currentStock: number,
    reason: string,
    adminId: string
  ): Promise<void> {
    const newStock = currentStock + delta

    await this.createStockEvents([
      {
        variant_id: variantId,
        order_id: null,
        event_type: StockEventType.ADJUSTED,
        quantity_change: delta,
        new_quantity: newStock,
        reason,
        created_by: adminId,
      },
    ])
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Query helpers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Returns all stock events for a given variant, newest-first.
   * Useful for the admin "Stock History" panel.
   */
  async getStockHistory(variantId: string): Promise<Record<string, unknown>[]> {
    return this.listStockEvents({ variant_id: variantId })
  }

  /**
   * Returns all ACTIVE reservations for a given variant.
   */
  async getActiveReservations(
    variantId: string
  ): Promise<Record<string, unknown>[]> {
    return this.listStockReservations({
      variant_id: variantId,
      status: ReservationStatus.ACTIVE,
    })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Scheduled job helper
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Scan all ACTIVE reservations and mark any whose `expiry_at` is in the past
   * as EXPIRED. Intended to be called by a scheduled Medusa job every 5 minutes.
   *
   * NOTE: This does NOT release the inventory back to Medusa's stocked_quantity.
   * A separate subscriber on the "reservation.expired" event (or a follow-up
   * call) should handle that to keep the two systems in sync.
   *
   * @returns The number of reservations that were expired.
   */
  async expireStaleReservations(): Promise<number> {
    const now = new Date()

    const active = await this.listStockReservations({
      status: ReservationStatus.ACTIVE,
    })

    const stale = active.filter(
      (r: Record<string, unknown>) =>
        r.expiry_at !== null &&
        r.expiry_at !== undefined &&
        new Date(r.expiry_at as string) < now
    )

    for (const reservation of stale) {
      await this.updateStockReservations(
        { id: reservation.id as string },
        { status: ReservationStatus.EXPIRED }
      )
    }

    return stale.length
  }
}

export default StockEventModuleService
