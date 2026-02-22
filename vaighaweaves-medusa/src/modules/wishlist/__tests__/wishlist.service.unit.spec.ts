// Mock @medusajs/framework/utils before any imports so WishlistModuleService
// doesn't need a real database connection during unit tests.
jest.mock("@medusajs/framework/utils", () => {
  return {
    MedusaService: (_models: unknown) => {
      return class MockMedusaBase {
        createWishlistItems: jest.Mock = jest.fn()
        listWishlistItems: jest.Mock = jest.fn()
        deleteWishlistItems: jest.Mock = jest.fn()
      }
    },
    model: {
      id: () => ({}),
      text: () => ({ nullable: () => ({}) }),
      dateTime: () => ({}),
      define: (_name: string, _fields: unknown) => ({}),
    },
    Module: (_name: string, _opts: unknown) => ({}),
  }
})

import WishlistModuleService from "../service"

const mockItem = (overrides = {}) => ({
  id: "item_01",
  customer_id: "cust_01",
  product_id: "prod_01",
  variant_id: null,
  created_at: new Date(),
  ...overrides,
})

describe("WishlistModuleService", () => {
  let service: WishlistModuleService

  beforeEach(() => {
    service = new WishlistModuleService()
    jest.clearAllMocks()
  })

  // ---- addItem -------------------------------------------------------

  it("addItem: creates and returns a wishlist item without variantId", async () => {
    const item = mockItem()
    ;(service as any).createWishlistItems.mockResolvedValue([item])

    const result = await service.addItem("cust_01", "prod_01")

    expect((service as any).createWishlistItems).toHaveBeenCalledWith([
      { customer_id: "cust_01", product_id: "prod_01", variant_id: null },
    ])
    expect(result).toEqual(item)
  })

  it("addItem: creates a wishlist item with a variantId", async () => {
    const item = mockItem({ variant_id: "var_01" })
    ;(service as any).createWishlistItems.mockResolvedValue([item])

    const result = await service.addItem("cust_01", "prod_01", "var_01")

    expect((service as any).createWishlistItems).toHaveBeenCalledWith([
      { customer_id: "cust_01", product_id: "prod_01", variant_id: "var_01" },
    ])
    expect(result.variant_id).toBe("var_01")
  })

  // ---- removeItem ----------------------------------------------------

  it("removeItem: deletes an item that belongs to the customer", async () => {
    const item = mockItem()
    ;(service as any).listWishlistItems.mockResolvedValue([item])
    ;(service as any).deleteWishlistItems.mockResolvedValue(undefined)

    await service.removeItem("item_01", "cust_01")

    expect((service as any).deleteWishlistItems).toHaveBeenCalledWith("item_01")
  })

  it("removeItem: throws when item not found", async () => {
    ;(service as any).listWishlistItems.mockResolvedValue([])

    await expect(service.removeItem("item_99", "cust_01")).rejects.toThrow(
      "Wishlist item item_99 not found"
    )
    expect((service as any).deleteWishlistItems).not.toHaveBeenCalled()
  })

  it("removeItem: throws when item belongs to a different customer", async () => {
    const item = mockItem({ customer_id: "cust_99" })
    ;(service as any).listWishlistItems.mockResolvedValue([item])

    await expect(service.removeItem("item_01", "cust_01")).rejects.toThrow(
      "does not belong to customer cust_01"
    )
    expect((service as any).deleteWishlistItems).not.toHaveBeenCalled()
  })

  // ---- getByCustomer -------------------------------------------------

  it("getByCustomer: returns all items for the given customer", async () => {
    const items = [mockItem(), mockItem({ id: "item_02", product_id: "prod_02" })]
    ;(service as any).listWishlistItems.mockResolvedValue(items)

    const result = await service.getByCustomer("cust_01")

    expect((service as any).listWishlistItems).toHaveBeenCalledWith({
      customer_id: "cust_01",
    })
    expect(result).toHaveLength(2)
  })

  // ---- clearAll ------------------------------------------------------

  it("clearAll: deletes all items belonging to the customer", async () => {
    const items = [mockItem(), mockItem({ id: "item_02" })]
    ;(service as any).listWishlistItems.mockResolvedValue(items)
    ;(service as any).deleteWishlistItems.mockResolvedValue(undefined)

    await service.clearAll("cust_01")

    expect((service as any).deleteWishlistItems).toHaveBeenCalledWith([
      "item_01",
      "item_02",
    ])
  })

  it("clearAll: does nothing when customer has no wishlist items", async () => {
    ;(service as any).listWishlistItems.mockResolvedValue([])

    await service.clearAll("cust_01")

    expect((service as any).deleteWishlistItems).not.toHaveBeenCalled()
  })

  // ---- isInWishlist --------------------------------------------------

  it("isInWishlist: returns true when item exists for customer+product", async () => {
    ;(service as any).listWishlistItems.mockResolvedValue([mockItem()])

    const result = await service.isInWishlist("cust_01", "prod_01")

    expect(result).toBe(true)
  })

  it("isInWishlist: returns false when no matching item", async () => {
    ;(service as any).listWishlistItems.mockResolvedValue([])

    const result = await service.isInWishlist("cust_01", "prod_99")

    expect(result).toBe(false)
  })

  it("isInWishlist: includes variantId in filter when provided", async () => {
    ;(service as any).listWishlistItems.mockResolvedValue([
      mockItem({ variant_id: "var_01" }),
    ])

    const result = await service.isInWishlist("cust_01", "prod_01", "var_01")

    expect((service as any).listWishlistItems).toHaveBeenCalledWith({
      customer_id: "cust_01",
      product_id: "prod_01",
      variant_id: "var_01",
    })
    expect(result).toBe(true)
  })
})
