/**
 * TDD Unit Tests: ImageOptimizerModuleService
 * Phase 2 — Product Catalog (Image Optimizer)
 *
 * Tests verify image processing logic in isolation. Sharp and AWS S3 are mocked.
 *
 * Run: npm run test:unit
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mock Sharp
// ─────────────────────────────────────────────────────────────────────────────
const mockSharpMetadata = jest.fn()
const mockSharpResize = jest.fn()
const mockSharpWebp = jest.fn()
const mockSharpToBuffer = jest.fn()

const mockSharpInstance = {
  metadata: mockSharpMetadata,
  resize: mockSharpResize,
  webp: mockSharpWebp,
  toBuffer: mockSharpToBuffer,
}

// Chainable
mockSharpResize.mockReturnValue(mockSharpInstance)
mockSharpWebp.mockReturnValue(mockSharpInstance)

const mockSharp = jest.fn(() => mockSharpInstance)
jest.mock("sharp", () => mockSharp)

// ─────────────────────────────────────────────────────────────────────────────
// Mock AWS S3
// ─────────────────────────────────────────────────────────────────────────────
const mockUploadDone = jest.fn()
jest.mock("@aws-sdk/lib-storage", () => ({
  Upload: jest.fn().mockImplementation(() => ({
    done: mockUploadDone,
  })),
}))

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Mock @medusajs/framework/utils
// ─────────────────────────────────────────────────────────────────────────────
jest.mock("@medusajs/framework/utils", () => {
  class MockMedusaBase {
    createImageVariants = jest.fn()
    listImageVariants = jest.fn()
    updateImageVariants = jest.fn()
    deleteImageVariants = jest.fn()
    retrieveImageVariant = jest.fn()
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
// Import AFTER mocks
// ─────────────────────────────────────────────────────────────────────────────
import ImageOptimizerModuleService from "../service"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function makeService(): ImageOptimizerModuleService {
  const service = new ImageOptimizerModuleService({} as any, {} as any)
  ;(service as any).createImageVariants.mockResolvedValue([{ id: "iv-001" }])
  ;(service as any).listImageVariants.mockResolvedValue([])
  return service
}

function makeBuffer(size = 1024): Buffer {
  return Buffer.alloc(size, 0xff)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
describe("ImageOptimizerModuleService", () => {
  let service: ImageOptimizerModuleService

  beforeEach(() => {
    jest.clearAllMocks()
    service = makeService()

    // Default Sharp behavior
    mockSharpMetadata.mockResolvedValue({ width: 1500, height: 2000 })
    mockSharpToBuffer.mockResolvedValue(makeBuffer(500))
    mockUploadDone.mockResolvedValue({})

    // Set env vars for S3
    process.env.AWS_S3_BUCKET_NAME = "test-bucket"
    process.env.AWS_CLOUDFRONT_DOMAIN = "cdn.example.com"
    process.env.AWS_REGION = "ap-south-1"
    process.env.AWS_ACCESS_KEY_ID = "test-key"
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret"
  })

  // ─────────────────────────────────────────────────────────────────────────
  // generateSizes
  // ─────────────────────────────────────────────────────────────────────────
  describe("generateSizes()", () => {
    it("produces 4 sized images from a 1500px wide original", async () => {
      const result = await service.generateSizes(makeBuffer())

      expect(result).toHaveLength(4) // thumb, sm, md, lg
      expect(result.map((r) => r.size)).toEqual(["thumb", "sm", "md", "lg"])
    })

    it("skips sizes larger than the original image", async () => {
      // Original is only 300px wide
      mockSharpMetadata.mockResolvedValue({ width: 300, height: 400 })

      const result = await service.generateSizes(makeBuffer())

      // Only thumb (150) and sm (400>300? no, 400>300=skip)
      // Actually: thumb=150 (150<300 ok), sm=400 (400>300 skip), md=800 (skip), lg=1200 (skip)
      expect(result).toHaveLength(1)
      expect(result[0].size).toBe("thumb")
    })

    it("outputs WebP format", async () => {
      const result = await service.generateSizes(makeBuffer())

      expect(mockSharpWebp).toHaveBeenCalled()
      for (const sized of result) {
        expect(sized.format).toBe("webp")
      }
    })

    it("uses fit:inside and withoutEnlargement", async () => {
      await service.generateSizes(makeBuffer())

      expect(mockSharpResize).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({ fit: "inside", withoutEnlargement: true })
      )
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // generateS3Key
  // ─────────────────────────────────────────────────────────────────────────
  describe("generateS3Key()", () => {
    it("generates correct S3 key with product ID, image ID, and size", () => {
      const key = service.generateS3Key("prod-123", "img-456", "thumb", "webp")
      expect(key).toBe("products/prod-123/img-456-thumb.webp")
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // processAndUpload
  // ─────────────────────────────────────────────────────────────────────────
  describe("processAndUpload()", () => {
    it("creates ImageVariant records for each size", async () => {
      const result = await service.processAndUpload(
        makeBuffer(),
        "prod-123",
        "img-456"
      )

      // 4 sizes for a 1500px original
      expect(result.variants).toHaveLength(4)
      expect((service as any).createImageVariants).toHaveBeenCalledTimes(4)
    })

    it("uploads to S3 for each variant", async () => {
      const { Upload } = require("@aws-sdk/lib-storage")

      await service.processAndUpload(makeBuffer(), "prod-123", "img-456")

      expect(Upload).toHaveBeenCalledTimes(4)
      expect(mockUploadDone).toHaveBeenCalledTimes(4)
    })

    it("generates CloudFront URLs", async () => {
      const result = await service.processAndUpload(
        makeBuffer(),
        "prod-123",
        "img-456"
      )

      for (const v of result.variants) {
        expect(v.url).toContain("https://cdn.example.com/products/prod-123/")
      }
    })

    it("sets CacheControl header on S3 uploads", async () => {
      const { Upload } = require("@aws-sdk/lib-storage")

      await service.processAndUpload(makeBuffer(), "prod-123", "img-456")

      const firstCall = Upload.mock.calls[0][0]
      expect(firstCall.params.CacheControl).toBe(
        "max-age=31536000, immutable"
      )
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // getVariantsForImage
  // ─────────────────────────────────────────────────────────────────────────
  describe("getVariantsForImage()", () => {
    it("calls listImageVariants filtered by image_id", async () => {
      const mockVariants = [
        { id: "iv-001", image_id: "img-456", size: "thumb" },
        { id: "iv-002", image_id: "img-456", size: "sm" },
      ]
      ;(service as any).listImageVariants.mockResolvedValue(mockVariants)

      const result = await service.getVariantsForImage("img-456")

      expect((service as any).listImageVariants).toHaveBeenCalledWith({
        image_id: "img-456",
      })
      expect(result).toHaveLength(2)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // getVariantsForImages (batch)
  // ─────────────────────────────────────────────────────────────────────────
  describe("getVariantsForImages()", () => {
    it("returns variants grouped by image_id", async () => {
      const mockVariants = [
        { id: "iv-001", image_id: "img-1", size: "thumb" },
        { id: "iv-002", image_id: "img-1", size: "sm" },
        { id: "iv-003", image_id: "img-2", size: "thumb" },
      ]
      ;(service as any).listImageVariants.mockResolvedValue(mockVariants)

      const result = await service.getVariantsForImages(["img-1", "img-2"])

      expect(result.get("img-1")).toHaveLength(2)
      expect(result.get("img-2")).toHaveLength(1)
    })
  })
})
