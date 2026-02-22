/**
 * TDD Unit Tests: StockEventModuleService
 * Phase 1.3 — medusa-plugin-stock-events
 *
 * These tests verify the business logic of StockEventModuleService
 * in isolation, without a real database. The MedusaService-generated
 * CRUD methods (createStockEvents, listStockReservations, etc.) are
 * mocked so tests run instantly and never touch PostgreSQL.
 *
 * Run: npm run test:unit
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mock @medusajs/framework/utils before any import that touches it
// ─────────────────────────────────────────────────────────────────────────────
jest.mock("@medusajs/framework/utils", () => {
  /**
   * MedusaService is a class factory: MedusaService({ StockEvent, ... })
   * returns a base class that StockEventModuleService can extend.
   * We return a MockBase that exposes jest.fn() stubs for every
   * generated CRUD method our service calls internally.
   */
  class MockMedusaBase {
    createStockEvents = jest.fn()
    listStockEvents = jest.fn()
    updateStockEvents = jest.fn()
    deleteStockEvents = jest.fn()
    createStockReservations = jest.fn()
    listStockReservations = jest.fn()
    updateStockReservations = jest.fn()
    deleteStockReservations = jest.fn()
  }

  return {
    MedusaService: jest.fn(() => MockMedusaBase),
    Module: jest.fn((key: string, opts: { service: unknown }) => opts.service),
    model: {
      define: jest.fn((_name: string, _fields: unknown) => ({})),
      id: jest.fn(() => ({ primaryKey: jest.fn(() => ({})) })),
      text: jest.fn(() => ({
        nullable: jest.fn(() => ({})),
        default: jest.fn(() => ({})),
      })),
      number: jest.fn(() => ({
        nullable: jest.fn(() => ({})),
      })),
      dateTime: jest.fn(() => ({
        nullable: jest.fn(() => ({})),
      })),
    },
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Import AFTER the mock is set up
// ─────────────────────────────────────────────────────────────────────────────
import StockEventModuleService from "../service"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function makeService(): StockEventModuleService {
  // The constructor receives (container, config) — both empty for unit tests
  const service = new StockEventModuleService({} as any, {} as any)
  // Provide sensible defaults so tests only override what they care about
  ;(service as any).createStockEvents.mockResolvedValue([{ id: "evt-001" }])
  ;(service as any).createStockReservations.mockResolvedValue([
    { id: "res-001", variant_id: "var-001", quantity: 2 },
  ])
  ;(service as any).listStockReservations.mockResolvedValue([])
  ;(service as any).listStockEvents.mockResolvedValue([])
  ;(service as any).updateStockReservations.mockResolvedValue({ id: "res-001" })
  return service
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
describe("StockEventModuleService", () => {
  let service: StockEventModuleService

  beforeEach(() => {
    jest.clearAllMocks()
    service = makeService()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // reserveStock
  // ───────────────────────────────────────────────────────────────────────────
  describe("reserveStock()", () => {
    it("returns success and creates a reservation + event when stock is available", async () => {
      const result = await service.reserveStock("var-001", 2, 10, {
        orderId: "ord-001",
        reservationType: "ONLINE",
      })

      expect(result.success).toBe(true)
      expect(result.reservation).toBeDefined()

      // Must create a StockReservation record
      expect((service as any).createStockReservations).toHaveBeenCalledTimes(1)
      const [reservationPayload] = (service as any).createStockReservations.mock
        .calls[0][0]
      expect(reservationPayload.variant_id).toBe("var-001")
      expect(reservationPayload.quantity).toBe(2)
      expect(reservationPayload.status).toBe("ACTIVE")
      expect(reservationPayload.order_id).toBe("ord-001")

      // Must log a RESERVED stock event
      expect((service as any).createStockEvents).toHaveBeenCalledTimes(1)
      const [eventPayload] = (service as any).createStockEvents.mock.calls[0][0]
      expect(eventPayload.event_type).toBe("RESERVED")
      expect(eventPayload.quantity_change).toBe(-2) // negative = stock consumed
      expect(eventPayload.new_quantity).toBe(8) // 10 - 2
      expect(eventPayload.variant_id).toBe("var-001")
    })

    it("returns failure with reason when requested quantity exceeds available stock", async () => {
      const result = await service.reserveStock("var-001", 5, 3) // only 3 in stock

      expect(result.success).toBe(false)
      expect(result.reason).toMatch(/insufficient stock/i)
      // Must NOT create any reservation or event
      expect((service as any).createStockReservations).not.toHaveBeenCalled()
      expect((service as any).createStockEvents).not.toHaveBeenCalled()
    })

    it("returns failure when quantity is zero", async () => {
      const result = await service.reserveStock("var-001", 0, 10)

      expect(result.success).toBe(false)
      expect(result.reason).toMatch(/greater than zero/i)
      expect((service as any).createStockReservations).not.toHaveBeenCalled()
    })

    it("returns failure when quantity is negative", async () => {
      const result = await service.reserveStock("var-001", -1, 10)

      expect(result.success).toBe(false)
      expect((service as any).createStockReservations).not.toHaveBeenCalled()
    })

    it("reserves exactly all remaining stock (edge: quantity === currentStock)", async () => {
      const result = await service.reserveStock("var-001", 10, 10)

      expect(result.success).toBe(true)
      const [eventPayload] = (service as any).createStockEvents.mock.calls[0][0]
      expect(eventPayload.new_quantity).toBe(0) // stock hits zero — allowed
    })

    it("sets reservation_type to PHONE for phone bookings", async () => {
      await service.reserveStock("var-001", 1, 5, {
        reservationType: "PHONE",
        customerName: "Priya S",
        customerPhone: "9876543210",
      })

      const [reservationPayload] = (service as any).createStockReservations.mock
        .calls[0][0]
      expect(reservationPayload.reservation_type).toBe("PHONE")
      expect(reservationPayload.customer_name).toBe("Priya S")
      expect(reservationPayload.customer_phone).toBe("9876543210")
    })

    it("sets expiry_at when expiryMinutes is provided", async () => {
      const before = Date.now()
      await service.reserveStock("var-001", 1, 5, { expiryMinutes: 30 })
      const after = Date.now()

      const [reservationPayload] = (service as any).createStockReservations.mock
        .calls[0][0]
      expect(reservationPayload.expiry_at).not.toBeNull()
      const expiry = new Date(reservationPayload.expiry_at).getTime()
      expect(expiry).toBeGreaterThanOrEqual(before + 30 * 60 * 1000 - 100)
      expect(expiry).toBeLessThanOrEqual(after + 30 * 60 * 1000 + 100)
    })

    it("leaves expiry_at null when expiryMinutes is not provided", async () => {
      await service.reserveStock("var-001", 1, 5)

      const [reservationPayload] = (service as any).createStockReservations.mock
        .calls[0][0]
      expect(reservationPayload.expiry_at).toBeNull()
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // releaseStock
  // ───────────────────────────────────────────────────────────────────────────
  describe("releaseStock()", () => {
    it("logs a RELEASED event and returns success", async () => {
      const result = await service.releaseStock("var-001", 2, 8, {
        orderId: "ord-001",
        reason: "Order cancelled by customer",
      })

      expect(result.success).toBe(true)

      expect((service as any).createStockEvents).toHaveBeenCalledTimes(1)
      const [eventPayload] = (service as any).createStockEvents.mock.calls[0][0]
      expect(eventPayload.event_type).toBe("RELEASED")
      expect(eventPayload.quantity_change).toBe(2) // positive = stock returned
      expect(eventPayload.new_quantity).toBe(10) // 8 + 2
      expect(eventPayload.reason).toBe("Order cancelled by customer")
    })

    it("cancels the matching active reservation when orderId is provided", async () => {
      ;(service as any).listStockReservations.mockResolvedValue([
        { id: "res-001", variant_id: "var-001", order_id: "ord-001", status: "ACTIVE" },
      ])

      await service.releaseStock("var-001", 2, 8, { orderId: "ord-001" })

      expect((service as any).listStockReservations).toHaveBeenCalledWith(
        expect.objectContaining({
          variant_id: "var-001",
          order_id: "ord-001",
          status: "ACTIVE",
        })
      )
      expect((service as any).updateStockReservations).toHaveBeenCalledWith(
        expect.objectContaining({ id: "res-001" }),
        expect.objectContaining({ status: "CANCELLED" })
      )
    })

    it("skips reservation update gracefully when no active reservation is found", async () => {
      ;(service as any).listStockReservations.mockResolvedValue([]) // none found

      const result = await service.releaseStock("var-001", 2, 8, {
        orderId: "ord-ghost",
      })

      expect(result.success).toBe(true)
      expect((service as any).updateStockReservations).not.toHaveBeenCalled()
      // event is still logged
      expect((service as any).createStockEvents).toHaveBeenCalledTimes(1)
    })

    it("returns failure when quantity is zero or negative", async () => {
      const zero = await service.releaseStock("var-001", 0, 5)
      expect(zero.success).toBe(false)

      const neg = await service.releaseStock("var-001", -3, 5)
      expect(neg.success).toBe(false)

      expect((service as any).createStockEvents).not.toHaveBeenCalled()
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // recordSale
  // ───────────────────────────────────────────────────────────────────────────
  describe("recordSale()", () => {
    it("marks the reservation FULFILLED and logs a SOLD event", async () => {
      ;(service as any).listStockReservations.mockResolvedValue([
        { id: "res-001", status: "ACTIVE" },
      ])

      await service.recordSale("var-001", 2, 8, "ord-001")

      expect((service as any).updateStockReservations).toHaveBeenCalledWith(
        expect.objectContaining({ id: "res-001" }),
        expect.objectContaining({ status: "FULFILLED" })
      )

      const [eventPayload] = (service as any).createStockEvents.mock.calls[0][0]
      expect(eventPayload.event_type).toBe("SOLD")
      expect(eventPayload.quantity_change).toBe(-2)
      expect(eventPayload.new_quantity).toBe(6) // 8 - 2
      expect(eventPayload.order_id).toBe("ord-001")
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // adjustStock
  // ───────────────────────────────────────────────────────────────────────────
  describe("adjustStock()", () => {
    it("logs an ADJUSTED event with positive delta (restock)", async () => {
      await service.adjustStock("var-001", 50, 20, "Received new stock batch", "admin-1")

      const [eventPayload] = (service as any).createStockEvents.mock.calls[0][0]
      expect(eventPayload.event_type).toBe("ADJUSTED")
      expect(eventPayload.quantity_change).toBe(50)
      expect(eventPayload.new_quantity).toBe(70) // 20 + 50
      expect(eventPayload.reason).toBe("Received new stock batch")
      expect(eventPayload.created_by).toBe("admin-1")
    })

    it("logs an ADJUSTED event with negative delta (write-off)", async () => {
      await service.adjustStock("var-001", -3, 20, "Damaged items written off", "admin-1")

      const [eventPayload] = (service as any).createStockEvents.mock.calls[0][0]
      expect(eventPayload.quantity_change).toBe(-3)
      expect(eventPayload.new_quantity).toBe(17) // 20 - 3
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // getStockHistory
  // ───────────────────────────────────────────────────────────────────────────
  describe("getStockHistory()", () => {
    it("calls listStockEvents filtered by variant_id", async () => {
      const mockEvents = [
        { id: "e1", event_type: "RESERVED", quantity_change: -2 },
        { id: "e2", event_type: "SOLD", quantity_change: -2 },
      ]
      ;(service as any).listStockEvents.mockResolvedValue(mockEvents)

      const result = await service.getStockHistory("var-001")

      expect((service as any).listStockEvents).toHaveBeenCalledWith(
        expect.objectContaining({ variant_id: "var-001" })
      )
      expect(result).toEqual(mockEvents)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // expireStaleReservations
  // ───────────────────────────────────────────────────────────────────────────
  describe("expireStaleReservations()", () => {
    it("marks past-expiry ACTIVE reservations as EXPIRED and returns count", async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      const future = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

      ;(service as any).listStockReservations.mockResolvedValue([
        { id: "res-001", status: "ACTIVE", expiry_at: past.toISOString() },
        { id: "res-002", status: "ACTIVE", expiry_at: future.toISOString() },
        { id: "res-003", status: "ACTIVE", expiry_at: null }, // no expiry = never expires
      ])

      const count = await service.expireStaleReservations()

      expect(count).toBe(1) // only res-001 is past expiry
      expect((service as any).updateStockReservations).toHaveBeenCalledTimes(1)
      expect((service as any).updateStockReservations).toHaveBeenCalledWith(
        expect.objectContaining({ id: "res-001" }),
        expect.objectContaining({ status: "EXPIRED" })
      )
    })

    it("returns 0 and makes no updates when all reservations are still valid", async () => {
      const future = new Date(Date.now() + 10 * 60 * 1000)
      ;(service as any).listStockReservations.mockResolvedValue([
        { id: "res-001", status: "ACTIVE", expiry_at: future.toISOString() },
      ])

      const count = await service.expireStaleReservations()

      expect(count).toBe(0)
      expect((service as any).updateStockReservations).not.toHaveBeenCalled()
    })
  })
})
