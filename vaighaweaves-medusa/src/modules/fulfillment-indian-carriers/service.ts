/**
 * IndianCarriersFulfillmentService
 *
 * Medusa v2 fulfillment provider for India Post.
 * Supports Speed Post and Business Parcel service types.
 *
 * Provider ID in DB: fp_indian-carriers_{config_id}
 */
import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import type {
  FulfillmentOption,
  CalculatedShippingOptionPrice,
  CreateFulfillmentResult,
  FulfillmentItemDTO,
  FulfillmentOrderDTO,
  FulfillmentDTO,
  ValidateFulfillmentDataContext,
  CalculateShippingOptionPriceDTO,
  CreateShippingOptionDTO,
} from "@medusajs/framework/types"
import { IndiaPostClient, type IndiaPostConfig } from "./india-post-client"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type IndianCarriersOptions = {
  india_post: IndiaPostConfig
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

class IndianCarriersFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "indian-carriers"

  protected options_: IndianCarriersOptions
  private indiaPostClient: IndiaPostClient | null = null

  constructor(container: Record<string, unknown>, options: IndianCarriersOptions) {
    super()
    this.options_ = options
  }

  private getIndiaPostClient(): IndiaPostClient {
    if (!this.indiaPostClient) {
      this.indiaPostClient = new IndiaPostClient(this.options_.india_post)
    }
    return this.indiaPostClient
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getFulfillmentOptions
  // ─────────────────────────────────────────────────────────────────────────

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      {
        id: "india-post-speed-post",
        name: "India Post — Speed Post",
        service_type: "speed-post",
        carrier: "india-post",
      },
      {
        id: "india-post-business-parcel",
        name: "India Post — Business Parcel",
        service_type: "business-parcel",
        carrier: "india-post",
      },
    ]
  }

  // ─────────────────────────────────────────────────────────────────────────
  // validateOption
  // ─────────────────────────────────────────────────────────────────────────

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    const validIds = ["india-post-speed-post", "india-post-business-parcel"]
    return validIds.includes(data.id as string)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // validateFulfillmentData
  // ─────────────────────────────────────────────────────────────────────────

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: ValidateFulfillmentDataContext
  ): Promise<any> {
    // Validate that receiver has pincode and phone
    if (!data.receiver_pincode && !context.shipping_address?.postal_code) {
      throw new Error("Receiver pincode is required for India Post shipping")
    }

    if (!data.receiver_phone && !context.shipping_address?.phone) {
      throw new Error("Receiver phone is required for India Post shipping")
    }

    const pincode =
      (data.receiver_pincode as string) ||
      context.shipping_address?.postal_code ||
      ""

    if (!/^\d{6}$/.test(pincode)) {
      throw new Error("Invalid Indian pincode. Must be exactly 6 digits.")
    }

    return {
      ...data,
      receiver_pincode: pincode,
      receiver_phone:
        (data.receiver_phone as string) ||
        context.shipping_address?.phone ||
        "",
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // canCalculate
  // ─────────────────────────────────────────────────────────────────────────

  async canCalculate(data: CreateShippingOptionDTO): Promise<boolean> {
    return true // India Post tariff API or fallback estimation always available
  }

  // ─────────────────────────────────────────────────────────────────────────
  // calculatePrice
  // ─────────────────────────────────────────────────────────────────────────

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    const serviceType =
      (optionData?.service_type as string) === "speed-post"
        ? "speed-post"
        : "business-parcel"

    // Default weight 500g if not specified (typical saree weight)
    const weightGrams = (data?.weight_grams as number) || 500
    const destPincode = (data?.receiver_pincode as string) || "500001"
    const sourcePincode = this.options_.india_post.sender_pincode || "500001"

    try {
      const client = this.getIndiaPostClient()
      const tariff = await client.getTariff(
        weightGrams,
        sourcePincode,
        destPincode,
        serviceType as "speed-post" | "business-parcel"
      )

      return {
        calculated_amount: tariff.total_amount * 100, // Medusa expects paise
        is_calculated_price_tax_inclusive: true, // GST already included
      }
    } catch {
      // Fallback to a flat rate if API call fails
      const flatRate = serviceType === "speed-post" ? 99 : 59
      return {
        calculated_amount: flatRate * 100,
        is_calculated_price_tax_inclusive: true,
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // createFulfillment
  // ─────────────────────────────────────────────────────────────────────────

  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    const serviceType =
      (data.service_type as string) === "speed-post"
        ? "speed-post"
        : "business-parcel"

    const receiverName =
      (data.receiver_name as string) ||
      [order?.shipping_address?.first_name, order?.shipping_address?.last_name]
        .filter(Boolean)
        .join(" ") ||
      "Customer"

    const receiverAddress = this.formatAddress(
      order?.shipping_address || data
    )

    const receiverPincode =
      (data.receiver_pincode as string) ||
      (order?.shipping_address?.postal_code as string) ||
      ""

    const receiverPhone =
      (data.receiver_phone as string) ||
      (order?.shipping_address?.phone as string) ||
      ""

    const weightGrams = (data.weight_grams as number) || 500
    const declaredValue = (data.declared_value as number) || 0
    const contentDescription =
      (data.content_description as string) ||
      items.map((i) => i.title || "Item").join(", ") ||
      "Handloom saree"

    const client = this.getIndiaPostClient()
    const result = await client.bookShipment({
      receiver_name: receiverName,
      receiver_address: receiverAddress,
      receiver_pincode: receiverPincode,
      receiver_phone: receiverPhone,
      weight_grams: weightGrams,
      content_description: contentDescription,
      declared_value: declaredValue,
      service_type: serviceType as "speed-post" | "business-parcel",
      order_id: (order?.id as string) || `medusa_${Date.now()}`,
      cod_amount: (data.cod_amount as number) || 0,
    })

    return {
      data: {
        ...data,
        tracking_number: result.tracking_number,
        article_number: result.article_number,
        carrier: "india-post",
        service_type: serviceType,
        total_tariff: result.total_tariff,
        expected_delivery_date: result.expected_delivery_date,
      },
      labels: [
        {
          tracking_number: result.tracking_number,
          tracking_url: `https://www.indiapost.gov.in/_layouts/15/DOP.Portal.Tracking/TrackConsignment.aspx?cno=${result.tracking_number}`,
          label_url: result.label_url || "",
        },
      ],
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // cancelFulfillment
  // ─────────────────────────────────────────────────────────────────────────

  async cancelFulfillment(data: Record<string, unknown>): Promise<any> {
    const trackingNumber = data.tracking_number as string
    if (!trackingNumber) return

    const client = this.getIndiaPostClient()
    await client.cancelShipment(trackingNumber)

    return { ...data, status: "cancelled" }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getFulfillmentDocuments
  // ─────────────────────────────────────────────────────────────────────────

  async getFulfillmentDocuments(data: Record<string, unknown>): Promise<any[]> {
    const trackingNumber = data.tracking_number as string
    if (!trackingNumber) return []

    try {
      const client = this.getIndiaPostClient()
      const labelUrl = await client.getLabel(trackingNumber)
      return [{ type: "label", url: labelUrl }]
    } catch {
      return []
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // createReturnFulfillment
  // ─────────────────────────────────────────────────────────────────────────

  async createReturnFulfillment(
    fulfillment: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    const originalData = fulfillment.data as Record<string, unknown> || {}
    const serviceType =
      (originalData.service_type as string) === "speed-post"
        ? "speed-post"
        : "business-parcel"

    // For returns, swap sender and receiver
    const client = this.getIndiaPostClient()
    const result = await client.bookShipment({
      receiver_name: this.options_.india_post.sender_name,
      receiver_address: this.options_.india_post.sender_address,
      receiver_pincode: this.options_.india_post.sender_pincode,
      receiver_phone: this.options_.india_post.sender_phone,
      weight_grams: (originalData.weight_grams as number) || 500,
      content_description: "Return shipment",
      declared_value: (originalData.declared_value as number) || 0,
      service_type: serviceType as "speed-post" | "business-parcel",
      order_id: `RET-${(originalData.order_id as string) || Date.now()}`,
    })

    return {
      data: {
        ...originalData,
        return_tracking_number: result.tracking_number,
        carrier: "india-post",
        is_return: true,
      },
      labels: [
        {
          tracking_number: result.tracking_number,
          tracking_url: `https://www.indiapost.gov.in/_layouts/15/DOP.Portal.Tracking/TrackConsignment.aspx?cno=${result.tracking_number}`,
          label_url: result.label_url || "",
        },
      ],
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Document retrieval methods (return empty for now)
  // ─────────────────────────────────────────────────────────────────────────

  async getReturnDocuments(data: Record<string, unknown>): Promise<any[]> {
    return this.getFulfillmentDocuments(data)
  }

  async getShipmentDocuments(data: Record<string, unknown>): Promise<any[]> {
    return this.getFulfillmentDocuments(data)
  }

  async retrieveDocuments(
    fulfillmentData: Record<string, unknown>,
    documentType: string
  ): Promise<any> {
    if (documentType === "label") {
      return this.getFulfillmentDocuments(fulfillmentData)
    }
    return []
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private formatAddress(addr: Record<string, any>): string {
    const parts: string[] = []
    if (addr.address_1) parts.push(addr.address_1)
    if (addr.address_2) parts.push(addr.address_2)
    if (addr.city) parts.push(addr.city)
    if (addr.province) parts.push(addr.province)
    return parts.join(", ") || "Address not provided"
  }
}

export default IndianCarriersFulfillmentService
