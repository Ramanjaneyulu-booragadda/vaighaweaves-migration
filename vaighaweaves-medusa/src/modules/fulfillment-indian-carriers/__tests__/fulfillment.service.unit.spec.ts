/**
 * Unit tests for IndianCarriersFulfillmentService
 *
 * Mocks the India Post API client and tests all AbstractFulfillmentProviderService methods.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mock IndiaPostClient
// ─────────────────────────────────────────────────────────────────────────────

const mockBookShipment = jest.fn()
const mockTrackShipment = jest.fn()
const mockCancelShipment = jest.fn()
const mockGetTariff = jest.fn()
const mockGetLabel = jest.fn()
const mockAuthenticate = jest.fn()

jest.mock("../india-post-client", () => ({
  IndiaPostClient: jest.fn().mockImplementation(() => ({
    bookShipment: mockBookShipment,
    trackShipment: mockTrackShipment,
    cancelShipment: mockCancelShipment,
    getTariff: mockGetTariff,
    getLabel: mockGetLabel,
    authenticate: mockAuthenticate,
  })),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Import after mock
// ─────────────────────────────────────────────────────────────────────────────

import IndianCarriersFulfillmentService from "../service"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS = {
  india_post: {
    api_url: "https://test.cept.gov.in/beextcustomer",
    customer_id: "test_customer",
    password: "test_pass",
    sender_name: "VaighaWeaves",
    sender_address: "123 Main St, Hyderabad, Telangana",
    sender_pincode: "500001",
    sender_phone: "+919876543210",
  },
}

function createService(optionOverrides = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...optionOverrides }
  return new IndianCarriersFulfillmentService({} as any, opts)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("IndianCarriersFulfillmentService", () => {
  let service: IndianCarriersFulfillmentService

  beforeEach(() => {
    jest.clearAllMocks()
    service = createService()
  })

  // ─── getFulfillmentOptions ──────────────────────────────────────────────

  describe("getFulfillmentOptions", () => {
    it("returns Speed Post and Business Parcel options", async () => {
      const options = await service.getFulfillmentOptions()

      expect(options).toHaveLength(2)
      expect(options[0].id).toBe("india-post-speed-post")
      expect(options[0].name).toBe("India Post — Speed Post")
      expect(options[1].id).toBe("india-post-business-parcel")
      expect(options[1].name).toBe("India Post — Business Parcel")
    })
  })

  // ─── validateOption ─────────────────────────────────────────────────────

  describe("validateOption", () => {
    it("returns true for valid option IDs", async () => {
      expect(
        await service.validateOption({ id: "india-post-speed-post" })
      ).toBe(true)
      expect(
        await service.validateOption({ id: "india-post-business-parcel" })
      ).toBe(true)
    })

    it("returns false for invalid option IDs", async () => {
      expect(await service.validateOption({ id: "fedex-express" })).toBe(false)
      expect(await service.validateOption({ id: "" })).toBe(false)
    })
  })

  // ─── validateFulfillmentData ────────────────────────────────────────────

  describe("validateFulfillmentData", () => {
    it("validates and returns data with valid pincode", async () => {
      const result = await service.validateFulfillmentData(
        {},
        { receiver_pincode: "400001", receiver_phone: "+919876543210" },
        { shipping_address: {} } as any
      )

      expect(result.receiver_pincode).toBe("400001")
      expect(result.receiver_phone).toBe("+919876543210")
    })

    it("uses context shipping_address when data fields missing", async () => {
      const result = await service.validateFulfillmentData(
        {},
        {},
        {
          shipping_address: {
            postal_code: "110001",
            phone: "+911234567890",
          },
        } as any
      )

      expect(result.receiver_pincode).toBe("110001")
      expect(result.receiver_phone).toBe("+911234567890")
    })

    it("throws on missing pincode", async () => {
      await expect(
        service.validateFulfillmentData({}, {}, {
          shipping_address: {},
        } as any)
      ).rejects.toThrow("Receiver pincode is required")
    })

    it("throws on invalid pincode format", async () => {
      await expect(
        service.validateFulfillmentData(
          {},
          { receiver_pincode: "12345" },
          { shipping_address: { phone: "123" } } as any
        )
      ).rejects.toThrow("Invalid Indian pincode")
    })
  })

  // ─── canCalculate ──────────────────────────────────────────────────────

  describe("canCalculate", () => {
    it("always returns true", async () => {
      expect(await service.canCalculate({} as any)).toBe(true)
    })
  })

  // ─── calculatePrice ────────────────────────────────────────────────────

  describe("calculatePrice", () => {
    it("returns tariff from India Post API in paise", async () => {
      mockGetTariff.mockResolvedValue({
        base_tariff: 75,
        gst_amount: 14,
        total_amount: 89,
        chargeable_weight: 500,
        delivery_type: "Inter-city",
      })

      const result = await service.calculatePrice(
        { service_type: "speed-post" } as any,
        { weight_grams: 500, receiver_pincode: "400001" } as any,
        {} as any
      )

      expect(result.calculated_amount).toBe(8900) // 89 * 100 paise
      expect(result.is_calculated_price_tax_inclusive).toBe(true)
      expect(mockGetTariff).toHaveBeenCalledWith(
        500,
        "500001",
        "400001",
        "speed-post"
      )
    })

    it("returns flat rate fallback on API failure", async () => {
      mockGetTariff.mockRejectedValue(new Error("API down"))

      const result = await service.calculatePrice(
        { service_type: "business-parcel" } as any,
        { weight_grams: 500, receiver_pincode: "400001" } as any,
        {} as any
      )

      expect(result.calculated_amount).toBe(5900) // 59 * 100 for business parcel
      expect(result.is_calculated_price_tax_inclusive).toBe(true)
    })
  })

  // ─── createFulfillment ─────────────────────────────────────────────────

  describe("createFulfillment", () => {
    it("books a shipment and returns tracking info", async () => {
      mockBookShipment.mockResolvedValue({
        tracking_number: "EE123456789IN",
        article_number: "ART123",
        base_tariff: 75,
        gst_amount: 14,
        total_tariff: 89,
        expected_delivery_date: "2026-02-25",
        label_url: "https://indiapost.gov.in/labels/EE123456789IN.pdf",
      })

      const result = await service.createFulfillment(
        {
          service_type: "speed-post",
          receiver_pincode: "400001",
          receiver_phone: "+919876543210",
          weight_grams: 500,
          declared_value: 1099,
        },
        [{ title: "Kanjivaram Silk Saree" }],
        {
          id: "order_123",
          shipping_address: {
            first_name: "Priya",
            last_name: "Sharma",
            address_1: "45 MG Road",
            city: "Mumbai",
            province: "Maharashtra",
            postal_code: "400001",
            phone: "+919876543210",
          },
        } as any,
        {}
      )

      expect(result.data.tracking_number).toBe("EE123456789IN")
      expect(result.data.carrier).toBe("india-post")
      expect(result.labels).toHaveLength(1)
      expect(result.labels[0].tracking_number).toBe("EE123456789IN")
      expect(result.labels[0].label_url).toBe(
        "https://indiapost.gov.in/labels/EE123456789IN.pdf"
      )
      expect(mockBookShipment).toHaveBeenCalledWith(
        expect.objectContaining({
          receiver_pincode: "400001",
          service_type: "speed-post",
          order_id: "order_123",
        })
      )
    })

    it("handles API failure gracefully", async () => {
      mockBookShipment.mockRejectedValue(
        new Error("India Post API unavailable")
      )

      await expect(
        service.createFulfillment(
          { service_type: "speed-post" },
          [],
          { id: "order_456" } as any,
          {}
        )
      ).rejects.toThrow("India Post API unavailable")
    })
  })

  // ─── cancelFulfillment ─────────────────────────────────────────────────

  describe("cancelFulfillment", () => {
    it("calls cancel API with tracking number", async () => {
      mockCancelShipment.mockResolvedValue(undefined)

      const result = await service.cancelFulfillment({
        tracking_number: "EE123456789IN",
      })

      expect(mockCancelShipment).toHaveBeenCalledWith("EE123456789IN")
      expect(result.status).toBe("cancelled")
    })

    it("does nothing when no tracking number", async () => {
      await service.cancelFulfillment({})
      expect(mockCancelShipment).not.toHaveBeenCalled()
    })
  })

  // ─── getFulfillmentDocuments ────────────────────────────────────────────

  describe("getFulfillmentDocuments", () => {
    it("returns label document", async () => {
      mockGetLabel.mockResolvedValue(
        "https://indiapost.gov.in/labels/EE123.pdf"
      )

      const result = await service.getFulfillmentDocuments({
        tracking_number: "EE123456789IN",
      })

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("label")
      expect(result[0].url).toBe("https://indiapost.gov.in/labels/EE123.pdf")
    })

    it("returns empty array when no tracking number", async () => {
      const result = await service.getFulfillmentDocuments({})
      expect(result).toEqual([])
    })
  })

  // ─── createReturnFulfillment ───────────────────────────────────────────

  describe("createReturnFulfillment", () => {
    it("creates return shipment with swapped sender/receiver", async () => {
      mockBookShipment.mockResolvedValue({
        tracking_number: "RET123456789IN",
        article_number: "RETART123",
        base_tariff: 50,
        gst_amount: 9,
        total_tariff: 59,
        label_url: "",
      })

      const result = await service.createReturnFulfillment({
        data: {
          tracking_number: "EE123456789IN",
          service_type: "business-parcel",
          weight_grams: 500,
          declared_value: 1099,
          order_id: "order_123",
        },
      })

      expect(result.data.return_tracking_number).toBe("RET123456789IN")
      expect(result.data.is_return).toBe(true)
      expect(mockBookShipment).toHaveBeenCalledWith(
        expect.objectContaining({
          receiver_name: "VaighaWeaves",
          receiver_pincode: "500001",
        })
      )
    })
  })

  // ─── IndiaPostClient.mapEventCodeToStatus ──────────────────────────────

  describe("IndiaPostClient.mapEventCodeToStatus", () => {
    it("maps event codes to normalized statuses", async () => {
      // Import the actual unmocked function for this test
      const { IndiaPostClient: RealClient } = jest.requireActual(
        "../india-post-client"
      )

      expect(RealClient.mapEventCodeToStatus("DELIVERED")).toBe("delivered")
      expect(RealClient.mapEventCodeToStatus("IN_TRANSIT")).toBe("in_transit")
      expect(RealClient.mapEventCodeToStatus("OUT_FOR_DELIVERY")).toBe(
        "out_for_delivery"
      )
      expect(RealClient.mapEventCodeToStatus("BOOKED")).toBe("booked")
      expect(RealClient.mapEventCodeToStatus("RTO")).toBe("rto_initiated")
      expect(RealClient.mapEventCodeToStatus("UNKNOWN_CODE")).toBe("unknown")
    })
  })
})
