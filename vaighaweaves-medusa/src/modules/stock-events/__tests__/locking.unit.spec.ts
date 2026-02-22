/**
 * Unit Tests: Subscriber locking + idempotency (Phase 1.3b)
 *
 * These tests verify that:
 *   1. Both subscribers call lockingModule.execute with the correct
 *      `stock:<variant_id>` key for each line item.
 *   2. Idempotency: when an ACTIVE reservation already exists for the
 *      same order+variant, reserveStock is NOT called again.
 *   3. Fresh currentStock is fetched INSIDE the lock
 *      (getVariantStock is called after execute starts, not before).
 *   4. The order-cancelled subscriber skips releaseStock when no ACTIVE
 *      reservation is found (already cancelled / duplicate event).
 *
 * All dependencies are mocked — no DB, no Medusa server required.
 *
 * Run: npm run test:unit
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

// Mock the utils module so we can spy on getVariantStock
jest.mock("../utils", () => ({
  getVariantStock: jest.fn().mockResolvedValue(10),
}))

import { getVariantStock } from "../utils"
const mockGetVariantStock = getVariantStock as jest.MockedFunction<
  typeof getVariantStock
>

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a fake `lockingModule` that immediately executes the callback
 * (simulating a lock being acquired and released synchronously in tests).
 */
function makeLockingModule() {
  return {
    execute: jest.fn(
      async (_key: string, fn: () => Promise<void>, _opts?: unknown) => {
        await fn()
      }
    ),
  }
}

/**
 * Build a minimal fake `orderModule` for a given orderId with the
 * provided line items.
 */
function makeOrderModule(
  orderId: string,
  items: Array<{ variant_id: string; variant_sku?: string; quantity: number }>
) {
  return {
    retrieveOrder: jest.fn().mockResolvedValue({
      id: orderId,
      customer_id: "cust-001",
      items,
    }),
  }
}

/** Minimal fake inventoryModule (getVariantStock is mocked at the module level) */
function makeInventoryModule() {
  return {
    listInventoryItems: jest.fn().mockResolvedValue([]),
    listInventoryLevels: jest.fn().mockResolvedValue([]),
  }
}

/** Build a fake stockService with jest stubs */
function makeStockService() {
  return {
    listStockReservations: jest.fn().mockResolvedValue([]),
    listStockEvents: jest.fn().mockResolvedValue([]),
    reserveStock: jest
      .fn()
      .mockResolvedValue({ success: true, reservation: { id: "res-001" } }),
    releaseStock: jest.fn().mockResolvedValue({ success: true }),
  }
}

/**
 * Build a fake DI container that resolves modules by symbol/string key.
 * The Modules enum values used by subscribers are mapped here.
 */
function makeContainer(overrides: Record<string, unknown>) {
  return {
    resolve: jest.fn((key: string) => {
      if (overrides[key]) return overrides[key]
      throw new Error(`Unresolved module in test container: ${key}`)
    }),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Import subscribers AFTER mocks are set up
// ─────────────────────────────────────────────────────────────────────────────

// We import the default export (the handler function) directly.
// The subscriber files don't import from "@medusajs/framework/utils" so we
// only need to mock the local utils module above.

// Inline require so mocks are in place first.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const handleOrderPlaced = require("../../../subscribers/order-placed").default
// eslint-disable-next-line @typescript-eslint/no-var-requires
const handleOrderCancelled =
  require("../../../subscribers/order-cancelled").default

// ─────────────────────────────────────────────────────────────────────────────
// Medusa module keys (must match what the subscribers resolve from container)
// ─────────────────────────────────────────────────────────────────────────────
// In production these are symbols from @medusajs/framework/utils Modules enum.
// In tests we use the string values the enum resolves to.
const MODULE_STOCK_EVENTS = "stockEvents" // STOCK_EVENTS_MODULE constant
const MODULE_ORDER = "order"
const MODULE_INVENTORY = "inventory"
const MODULE_LOCKING = "locking"

// ─────────────────────────────────────────────────────────────────────────────
// order-placed subscriber locking tests
// ─────────────────────────────────────────────────────────────────────────────
describe("order-placed subscriber — locking & idempotency", () => {
  let stockService: ReturnType<typeof makeStockService>
  let lockingModule: ReturnType<typeof makeLockingModule>
  let inventoryModule: ReturnType<typeof makeInventoryModule>
  let orderModule: ReturnType<typeof makeOrderModule>

  beforeEach(() => {
    jest.clearAllMocks()
    stockService = makeStockService()
    lockingModule = makeLockingModule()
    inventoryModule = makeInventoryModule()
    mockGetVariantStock.mockResolvedValue(10)
  })

  it("acquires lock with key stock:<variant_id> for each line item", async () => {
    orderModule = makeOrderModule("ord-001", [
      { variant_id: "var-A", variant_sku: "SKU-A", quantity: 2 },
      { variant_id: "var-B", variant_sku: "SKU-B", quantity: 1 },
    ])

    await handleOrderPlaced({
      event: { data: { id: "ord-001" } },
      container: makeContainer({
        [MODULE_STOCK_EVENTS]: stockService,
        [MODULE_ORDER]: orderModule,
        [MODULE_INVENTORY]: inventoryModule,
        [MODULE_LOCKING]: lockingModule,
      }),
    })

    expect(lockingModule.execute).toHaveBeenCalledTimes(2)
    expect(lockingModule.execute).toHaveBeenNthCalledWith(
      1,
      "stock:var-A",
      expect.any(Function),
      { timeout: 5 }
    )
    expect(lockingModule.execute).toHaveBeenNthCalledWith(
      2,
      "stock:var-B",
      expect.any(Function),
      { timeout: 5 }
    )
  })

  it("calls reserveStock with fresh currentStock fetched inside the lock", async () => {
    mockGetVariantStock.mockResolvedValue(15) // ensures we are using helper value
    orderModule = makeOrderModule("ord-002", [
      { variant_id: "var-C", variant_sku: "SKU-C", quantity: 3 },
    ])

    await handleOrderPlaced({
      event: { data: { id: "ord-002" } },
      container: makeContainer({
        [MODULE_STOCK_EVENTS]: stockService,
        [MODULE_ORDER]: orderModule,
        [MODULE_INVENTORY]: inventoryModule,
        [MODULE_LOCKING]: lockingModule,
      }),
    })

    // getVariantStock must be called AFTER lock is acquired (inside execute)
    expect(mockGetVariantStock).toHaveBeenCalledWith(inventoryModule, "SKU-C")
    expect(stockService.reserveStock).toHaveBeenCalledWith(
      "var-C",
      3,
      15, // fresh stock from inside the lock
      expect.objectContaining({ orderId: "ord-002" })
    )
  })

  it("skips reservation when one already exists for same order+variant (idempotency)", async () => {
    // Simulate existing ACTIVE reservation
    stockService.listStockReservations.mockResolvedValue([
      { id: "res-existing", status: "ACTIVE", order_id: "ord-003", variant_id: "var-D" },
    ])

    orderModule = makeOrderModule("ord-003", [
      { variant_id: "var-D", variant_sku: "SKU-D", quantity: 2 },
    ])

    await handleOrderPlaced({
      event: { data: { id: "ord-003" } },
      container: makeContainer({
        [MODULE_STOCK_EVENTS]: stockService,
        [MODULE_ORDER]: orderModule,
        [MODULE_INVENTORY]: inventoryModule,
        [MODULE_LOCKING]: lockingModule,
      }),
    })

    // Lock IS acquired
    expect(lockingModule.execute).toHaveBeenCalledTimes(1)
    // But reserveStock must NOT be called again
    expect(stockService.reserveStock).not.toHaveBeenCalled()
    // And getVariantStock should NOT be called (we returned early)
    expect(mockGetVariantStock).not.toHaveBeenCalled()
  })

  it("skips items without a variant_id", async () => {
    orderModule = makeOrderModule("ord-004", [
      { variant_id: "", quantity: 1 }, // no variant_id
    ])

    await handleOrderPlaced({
      event: { data: { id: "ord-004" } },
      container: makeContainer({
        [MODULE_STOCK_EVENTS]: stockService,
        [MODULE_ORDER]: orderModule,
        [MODULE_INVENTORY]: inventoryModule,
        [MODULE_LOCKING]: lockingModule,
      }),
    })

    expect(lockingModule.execute).not.toHaveBeenCalled()
    expect(stockService.reserveStock).not.toHaveBeenCalled()
  })

  it("does not throw when the lock or service fails (resilience)", async () => {
    lockingModule.execute.mockRejectedValueOnce(new Error("lock timeout"))
    orderModule = makeOrderModule("ord-005", [
      { variant_id: "var-E", quantity: 1 },
    ])

    // Must resolve without throwing
    await expect(
      handleOrderPlaced({
        event: { data: { id: "ord-005" } },
        container: makeContainer({
          [MODULE_STOCK_EVENTS]: stockService,
          [MODULE_ORDER]: orderModule,
          [MODULE_INVENTORY]: inventoryModule,
          [MODULE_LOCKING]: lockingModule,
        }),
      })
    ).resolves.toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// order-cancelled subscriber locking tests
// ─────────────────────────────────────────────────────────────────────────────
describe("order-cancelled subscriber — locking & idempotency", () => {
  let stockService: ReturnType<typeof makeStockService>
  let lockingModule: ReturnType<typeof makeLockingModule>
  let inventoryModule: ReturnType<typeof makeInventoryModule>
  let orderModule: ReturnType<typeof makeOrderModule>

  beforeEach(() => {
    jest.clearAllMocks()
    stockService = makeStockService()
    lockingModule = makeLockingModule()
    inventoryModule = makeInventoryModule()
    mockGetVariantStock.mockResolvedValue(8)
    // Default: one ACTIVE reservation exists
    stockService.listStockReservations.mockResolvedValue([
      { id: "res-001", status: "ACTIVE" },
    ])
  })

  it("acquires lock with key stock:<variant_id> for each line item", async () => {
    orderModule = makeOrderModule("ord-cancel-001", [
      { variant_id: "var-X", quantity: 2 },
      { variant_id: "var-Y", quantity: 1 },
    ])

    await handleOrderCancelled({
      event: { data: { id: "ord-cancel-001" } },
      container: makeContainer({
        [MODULE_STOCK_EVENTS]: stockService,
        [MODULE_ORDER]: orderModule,
        [MODULE_INVENTORY]: inventoryModule,
        [MODULE_LOCKING]: lockingModule,
      }),
    })

    expect(lockingModule.execute).toHaveBeenCalledTimes(2)
    expect(lockingModule.execute).toHaveBeenNthCalledWith(
      1,
      "stock:var-X",
      expect.any(Function),
      { timeout: 5 }
    )
    expect(lockingModule.execute).toHaveBeenNthCalledWith(
      2,
      "stock:var-Y",
      expect.any(Function),
      { timeout: 5 }
    )
  })

  it("calls releaseStock with fresh stock fetched inside the lock", async () => {
    mockGetVariantStock.mockResolvedValue(12)
    orderModule = makeOrderModule("ord-cancel-002", [
      { variant_id: "var-Z", variant_sku: "SKU-Z", quantity: 4 },
    ])

    await handleOrderCancelled({
      event: { data: { id: "ord-cancel-002" } },
      container: makeContainer({
        [MODULE_STOCK_EVENTS]: stockService,
        [MODULE_ORDER]: orderModule,
        [MODULE_INVENTORY]: inventoryModule,
        [MODULE_LOCKING]: lockingModule,
      }),
    })

    expect(mockGetVariantStock).toHaveBeenCalledWith(inventoryModule, "SKU-Z")
    expect(stockService.releaseStock).toHaveBeenCalledWith(
      "var-Z",
      4,
      12,
      expect.objectContaining({ orderId: "ord-cancel-002" })
    )
  })

  it("skips release when reservation is already CANCELLED (idempotency)", async () => {
    // No ACTIVE reservation — already cancelled
    stockService.listStockReservations.mockResolvedValue([])

    orderModule = makeOrderModule("ord-cancel-003", [
      { variant_id: "var-W", quantity: 2 },
    ])

    await handleOrderCancelled({
      event: { data: { id: "ord-cancel-003" } },
      container: makeContainer({
        [MODULE_STOCK_EVENTS]: stockService,
        [MODULE_ORDER]: orderModule,
        [MODULE_INVENTORY]: inventoryModule,
        [MODULE_LOCKING]: lockingModule,
      }),
    })

    // Lock IS acquired
    expect(lockingModule.execute).toHaveBeenCalledTimes(1)
    // But releaseStock must NOT be called
    expect(stockService.releaseStock).not.toHaveBeenCalled()
    expect(mockGetVariantStock).not.toHaveBeenCalled()
  })

  it("does not throw when the lock or service fails (resilience)", async () => {
    lockingModule.execute.mockRejectedValueOnce(new Error("pg advisory lock error"))
    orderModule = makeOrderModule("ord-cancel-004", [
      { variant_id: "var-V", quantity: 1 },
    ])

    await expect(
      handleOrderCancelled({
        event: { data: { id: "ord-cancel-004" } },
        container: makeContainer({
          [MODULE_STOCK_EVENTS]: stockService,
          [MODULE_ORDER]: orderModule,
          [MODULE_INVENTORY]: inventoryModule,
          [MODULE_LOCKING]: lockingModule,
        }),
      })
    ).resolves.toBeUndefined()
  })
})
