/**
 * TDD Unit Tests: ProductMetadataModuleService
 * Phase 2 — Product Catalog
 *
 * These tests verify the business logic of ProductMetadataModuleService
 * in isolation, without a real database. The MedusaService-generated
 * CRUD methods are mocked so tests run instantly and never touch PostgreSQL.
 *
 * Run: npm run test:unit
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mock @medusajs/framework/utils before any import that touches it
// ─────────────────────────────────────────────────────────────────────────────
jest.mock("@medusajs/framework/utils", () => {
  class MockMedusaBase {
    createProductMetadatas = jest.fn()
    listProductMetadatas = jest.fn()
    updateProductMetadatas = jest.fn()
    deleteProductMetadatas = jest.fn()
    retrieveProductMetadata = jest.fn()
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
        default: jest.fn(() => ({})),
      })),
      boolean: jest.fn(() => ({
        default: jest.fn(() => ({})),
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
import ProductMetadataModuleService from "../service"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function makeService(): ProductMetadataModuleService {
  const service = new ProductMetadataModuleService({} as any, {} as any)

  // Sensible defaults — tests override what they care about
  ;(service as any).createProductMetadatas.mockResolvedValue([
    { id: "pm-001", brand: null, is_featured: false, view_count: 0 },
  ])
  ;(service as any).listProductMetadatas.mockResolvedValue([])
  ;(service as any).updateProductMetadatas.mockResolvedValue({
    id: "pm-001",
    view_count: 1,
  })
  ;(service as any).retrieveProductMetadata.mockResolvedValue({
    id: "pm-001",
    view_count: 0,
  })

  return service
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
describe("ProductMetadataModuleService", () => {
  let service: ProductMetadataModuleService

  beforeEach(() => {
    jest.clearAllMocks()
    service = makeService()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // upsertForProduct
  // ─────────────────────────────────────────────────────────────────────────
  describe("upsertForProduct()", () => {
    it("creates a new record when productMetadataId is null", async () => {
      const result = await service.upsertForProduct(null, {
        brand: "VaighaWeaves",
        fabric: "silk",
        is_featured: true,
      })

      expect(result).toBeDefined()
      expect((service as any).createProductMetadatas).toHaveBeenCalledTimes(1)
      const [payload] = (service as any).createProductMetadatas.mock.calls[0][0]
      expect(payload.brand).toBe("VaighaWeaves")
      expect(payload.fabric).toBe("silk")
      expect(payload.is_featured).toBe(true)
      // Must NOT call update
      expect((service as any).updateProductMetadatas).not.toHaveBeenCalled()
    })

    it("updates existing record when productMetadataId is provided", async () => {
      const result = await service.upsertForProduct("pm-001", {
        brand: "Updated Brand",
        occasion: "wedding",
      })

      expect(result).toBeDefined()
      expect((service as any).updateProductMetadatas).toHaveBeenCalledTimes(1)
      expect((service as any).updateProductMetadatas).toHaveBeenCalledWith(
        { id: "pm-001" },
        expect.objectContaining({
          brand: "Updated Brand",
          occasion: "wedding",
        })
      )
      // Must NOT call create
      expect((service as any).createProductMetadatas).not.toHaveBeenCalled()
    })

    it("handles partial updates — only provided fields are sent", async () => {
      await service.upsertForProduct("pm-001", { fabric: "cotton" })

      const updateCall = (service as any).updateProductMetadatas.mock.calls[0]
      expect(updateCall[1]).toEqual({ fabric: "cotton" })
      // Other fields should not be in the update payload
      expect(updateCall[1].brand).toBeUndefined()
      expect(updateCall[1].occasion).toBeUndefined()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // incrementViewCount
  // ─────────────────────────────────────────────────────────────────────────
  describe("incrementViewCount()", () => {
    it("increments view_count from 0 to 1", async () => {
      ;(service as any).retrieveProductMetadata.mockResolvedValue({
        id: "pm-001",
        view_count: 0,
      })

      await service.incrementViewCount("pm-001")

      expect((service as any).retrieveProductMetadata).toHaveBeenCalledWith(
        "pm-001"
      )
      expect((service as any).updateProductMetadatas).toHaveBeenCalledWith(
        { id: "pm-001" },
        { view_count: 1 }
      )
    })

    it("increments view_count from N to N+1", async () => {
      ;(service as any).retrieveProductMetadata.mockResolvedValue({
        id: "pm-001",
        view_count: 42,
      })

      await service.incrementViewCount("pm-001")

      expect((service as any).updateProductMetadatas).toHaveBeenCalledWith(
        { id: "pm-001" },
        { view_count: 43 }
      )
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // getFeaturedProducts
  // ─────────────────────────────────────────────────────────────────────────
  describe("getFeaturedProducts()", () => {
    it("returns only records with is_featured=true", async () => {
      const featured = [
        { id: "pm-001", is_featured: true, brand: "VaighaWeaves" },
        { id: "pm-005", is_featured: true, brand: "SilkHouse" },
      ]
      ;(service as any).listProductMetadatas.mockResolvedValue(featured)

      const result = await service.getFeaturedProducts()

      expect((service as any).listProductMetadatas).toHaveBeenCalledWith({
        is_featured: true,
      })
      expect(result).toHaveLength(2)
      expect(result).toEqual(featured)
    })

    it("returns empty array when no products are featured", async () => {
      ;(service as any).listProductMetadatas.mockResolvedValue([])

      const result = await service.getFeaturedProducts()

      expect(result).toEqual([])
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // filterByAttributes
  // ─────────────────────────────────────────────────────────────────────────
  describe("filterByAttributes()", () => {
    it("filters by a single attribute (fabric=silk)", async () => {
      const silkProducts = [
        { id: "pm-001", fabric: "silk" },
        { id: "pm-003", fabric: "silk" },
      ]
      ;(service as any).listProductMetadatas.mockResolvedValue(silkProducts)

      const result = await service.filterByAttributes({ fabric: "silk" })

      expect((service as any).listProductMetadatas).toHaveBeenCalledWith({
        fabric: "silk",
      })
      expect(result).toHaveLength(2)
    })

    it("filters by multiple attributes (fabric + occasion)", async () => {
      const filtered = [{ id: "pm-001", fabric: "silk", occasion: "wedding" }]
      ;(service as any).listProductMetadatas.mockResolvedValue(filtered)

      const result = await service.filterByAttributes({
        fabric: "silk",
        occasion: "wedding",
      })

      expect((service as any).listProductMetadatas).toHaveBeenCalledWith({
        fabric: "silk",
        occasion: "wedding",
      })
      expect(result).toHaveLength(1)
    })

    it("returns all records when no filters are provided", async () => {
      const all = [{ id: "pm-001" }, { id: "pm-002" }, { id: "pm-003" }]
      ;(service as any).listProductMetadatas.mockResolvedValue(all)

      const result = await service.filterByAttributes({})

      // Empty filter object = list all
      expect((service as any).listProductMetadatas).toHaveBeenCalledWith({})
      expect(result).toHaveLength(3)
    })

    it("ignores undefined filter values", async () => {
      ;(service as any).listProductMetadatas.mockResolvedValue([])

      await service.filterByAttributes({
        fabric: "cotton",
        occasion: undefined,
        color: undefined,
      })

      // Only 'fabric' should be in the query
      expect((service as any).listProductMetadatas).toHaveBeenCalledWith({
        fabric: "cotton",
      })
    })
  })
})
