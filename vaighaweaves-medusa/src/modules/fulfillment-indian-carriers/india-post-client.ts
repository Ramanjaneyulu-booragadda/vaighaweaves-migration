/**
 * India Post BExT API Client
 *
 * Handles authentication, booking, tracking, label generation,
 * and tariff calculation with the India Post BExT Customer API.
 *
 * Adapted from the old system's IndiaPostCarrier.ts.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type IndiaPostConfig = {
  api_url: string // https://bext.cept.gov.in/beextcustomer
  customer_id: string
  password: string
  sender_name: string
  sender_address: string
  sender_pincode: string
  sender_phone: string
}

export interface BookShipmentRequest {
  receiver_name: string
  receiver_address: string
  receiver_pincode: string
  receiver_phone: string
  weight_grams: number
  length_cm?: number
  breadth_cm?: number
  height_cm?: number
  content_description: string
  declared_value: number
  cod_amount?: number
  service_type: "speed-post" | "business-parcel"
  order_id: string
}

export interface BookShipmentResponse {
  tracking_number: string
  article_number: string
  base_tariff: number
  gst_amount: number
  total_tariff: number
  expected_delivery_date?: string
  label_url?: string
}

export interface TrackingEvent {
  event_code: string
  description: string
  date: string
  time: string
  office: string
  office_pincode: string
}

export interface TrackingResponse {
  tracking_number: string
  status: string
  events: TrackingEvent[]
}

export interface TariffResponse {
  base_tariff: number
  gst_amount: number
  total_amount: number
  chargeable_weight: number
  delivery_type: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Status mapping
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_CODE_STATUS_MAP: Record<string, string> = {
  BOOKED: "booked",
  MANIFESTED: "booked",
  PICKED: "picked_up",
  PICKUP_COMPLETED: "picked_up",
  BAG_INSERTED: "picked_up",
  IN_TRANSIT: "in_transit",
  RECEIVED: "in_transit",
  DISPATCHED: "in_transit",
  OFFICE_RECEIVED: "in_transit",
  BAG_OPENED: "in_transit",
  OUT_FOR_DELIVERY: "out_for_delivery",
  WITH_POSTMAN: "out_for_delivery",
  DELIVERED: "delivered",
  DELIVERY_COMPLETED: "delivered",
  ATTEMPTED: "delivery_attempted",
  DELIVERY_FAILED: "delivery_attempted",
  UNDELIVERED: "delivery_attempted",
  REFUSED: "delivery_attempted",
  ADDRESS_INCOMPLETE: "delivery_attempted",
  RTO: "rto_initiated",
  RETURN_TO_ORIGIN: "rto_initiated",
  RTO_IN_TRANSIT: "rto_initiated",
  RTO_DELIVERED: "rto_delivered",
  RETURNED: "rto_delivered",
  LOST: "lost",
  DAMAGED: "damaged",
  CANCELLED: "cancelled",
}

// ─────────────────────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────────────────────

export class IndiaPostClient {
  private config: IndiaPostConfig
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private tokenExpiresAt: number = 0

  constructor(config: IndiaPostConfig) {
    this.config = config
  }

  /**
   * Authenticate with the BExT API and cache the token.
   */
  async authenticate(): Promise<void> {
    const url = `${this.config.api_url}/access/login`
    const body = new URLSearchParams({
      username: this.config.customer_id,
      password: this.config.password,
    })

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })

    if (!res.ok) {
      throw new Error(`India Post auth failed: ${res.status} ${res.statusText}`)
    }

    const data = await res.json()
    this.accessToken = data.access_token || data.token
    this.refreshToken = data.refresh_token || null
    // Expire 60 seconds before actual expiry for safety
    this.tokenExpiresAt = Date.now() + ((data.expires_in || 3600) - 60) * 1000
  }

  /**
   * Ensure we have a valid token, refreshing if needed.
   */
  private async ensureAuth(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken
    }

    if (this.refreshToken) {
      try {
        const url = `${this.config.api_url}/access/TokenWithRtoken`
        const body = new URLSearchParams({ refreshToken: this.refreshToken })
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        })
        if (res.ok) {
          const data = await res.json()
          this.accessToken = data.access_token || data.token
          this.tokenExpiresAt =
            Date.now() + ((data.expires_in || 3600) - 60) * 1000
          return this.accessToken!
        }
      } catch {
        // Fall through to full auth
      }
    }

    await this.authenticate()
    return this.accessToken!
  }

  /**
   * Book a shipment via the BExT API.
   */
  async bookShipment(req: BookShipmentRequest): Promise<BookShipmentResponse> {
    const token = await this.ensureAuth()
    const serviceId = req.service_type === "speed-post" ? "1" : "2"

    const payload = {
      CustomerId: this.config.customer_id,
      Password: this.config.password,
      TransactionId: `VW${req.order_id}-${Date.now()}`,
      ServiceId: serviceId,
      SenderName: this.config.sender_name,
      SenderAddress: this.config.sender_address,
      SenderPincode: this.config.sender_pincode,
      SenderPhone: this.config.sender_phone,
      ReceiverName: req.receiver_name,
      ReceiverAddress: req.receiver_address,
      ReceiverPincode: req.receiver_pincode,
      ReceiverPhone: req.receiver_phone,
      Weight: req.weight_grams,
      Length: req.length_cm || 20,
      Breadth: req.breadth_cm || 15,
      Height: req.height_cm || 10,
      ContentDescription: req.content_description,
      DeclaredValue: req.declared_value,
      CodAmount: req.cod_amount || 0,
      InsuredValue: req.declared_value,
      ArticleType: "Parcel",
      PaymentMethod: (req.cod_amount || 0) > 0 ? "COD" : "Prepaid",
    }

    const res = await fetch(`${this.config.api_url}/book`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error(
        `India Post booking failed: ${res.status} ${res.statusText}`
      )
    }

    const data = await res.json()

    if (data.ResponseCode !== "0" && data.ResponseCode !== "SUCCESS") {
      throw new Error(
        `India Post booking error: ${data.ResponseMessage || data.ResponseCode}`
      )
    }

    return {
      tracking_number: data.TrackingNumber,
      article_number: data.ArticleNumber || data.TrackingNumber,
      base_tariff: data.BaseTariff || 0,
      gst_amount: data.GstAmount || 0,
      total_tariff: data.TotalTariff || 0,
      expected_delivery_date: data.ExpectedDeliveryDate,
      label_url: data.LabelUrl,
    }
  }

  /**
   * Track a shipment by tracking number.
   */
  async trackShipment(trackingNumber: string): Promise<TrackingResponse> {
    const token = await this.ensureAuth()

    const res = await fetch(`${this.config.api_url}/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ TrackingNumber: trackingNumber }),
    })

    if (!res.ok) {
      throw new Error(
        `India Post tracking failed: ${res.status} ${res.statusText}`
      )
    }

    const data = await res.json()
    const events: TrackingEvent[] = (data.Events || []).map((e: any) => ({
      event_code: e.EventCode,
      description: e.EventDescription,
      date: e.EventDate,
      time: e.EventTime,
      office: e.Office,
      office_pincode: e.OfficePincode,
    }))

    // Determine overall status from the latest event
    const latestEvent = events[0]
    const status = latestEvent
      ? EVENT_CODE_STATUS_MAP[latestEvent.event_code] || "unknown"
      : "unknown"

    return { tracking_number: trackingNumber, status, events }
  }

  /**
   * Cancel a shipment.
   */
  async cancelShipment(trackingNumber: string): Promise<void> {
    const token = await this.ensureAuth()

    const res = await fetch(`${this.config.api_url}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ TrackingNumber: trackingNumber }),
    })

    if (!res.ok) {
      throw new Error(
        `India Post cancel failed: ${res.status} ${res.statusText}`
      )
    }
  }

  /**
   * Get tariff/pricing for a shipment.
   */
  async getTariff(
    weightGrams: number,
    sourcePincode: string,
    destPincode: string,
    serviceType: "speed-post" | "business-parcel"
  ): Promise<TariffResponse> {
    const token = await this.ensureAuth()

    const endpoint =
      serviceType === "speed-post"
        ? "/v1/speed-post/tariffs"
        : "/v1/business-parcel-tariff/calculate"

    const productCode = serviceType === "speed-post" ? "SP" : "BP"

    const params = new URLSearchParams({
      "product-code": productCode,
      weight: String(weightGrams),
      "source-pincode": sourcePincode,
      "destination-pincode": destPincode,
      length: "20",
      width: "15",
      height: "10",
    })

    const res = await fetch(
      `${this.config.api_url}${endpoint}?${params.toString()}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    if (!res.ok) {
      // Fallback to estimated pricing
      return this.estimateTariff(weightGrams, sourcePincode, destPincode, serviceType)
    }

    const data = await res.json()
    return {
      base_tariff: data.base_tariff || data.price || 0,
      gst_amount: data.total_tax || data.cgst + data.sgst || 0,
      total_amount: data.final_amount || data.total_with_tax || 0,
      chargeable_weight: data.chargeable_weight || weightGrams,
      delivery_type: data.delivery_type || "Inter-city",
    }
  }

  /**
   * Generate shipping label URL.
   */
  async getLabel(trackingNumber: string): Promise<string> {
    const token = await this.ensureAuth()

    const res = await fetch(`${this.config.api_url}/label`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ TrackingNumber: trackingNumber }),
    })

    if (!res.ok) {
      throw new Error(
        `India Post label failed: ${res.status} ${res.statusText}`
      )
    }

    const data = await res.json()
    return data.LabelUrl || data.label_url || ""
  }

  /**
   * Fallback weight-based tariff estimation when API is unavailable.
   */
  private estimateTariff(
    weightGrams: number,
    sourcePincode: string,
    destPincode: string,
    serviceType: "speed-post" | "business-parcel"
  ): TariffResponse {
    const isLocal = sourcePincode.substring(0, 2) === destPincode.substring(0, 2)

    let baseTariff: number
    if (weightGrams <= 500) {
      baseTariff = isLocal ? 35 : 50
    } else if (weightGrams <= 1000) {
      baseTariff = isLocal ? 45 : 70
    } else if (weightGrams <= 2000) {
      baseTariff = isLocal ? 60 : 100
    } else {
      const extraKg = Math.ceil((weightGrams - 2000) / 1000)
      baseTariff = (isLocal ? 60 : 100) + extraKg * (isLocal ? 15 : 30)
    }

    // Speed Post is ~1.5x Business Parcel
    if (serviceType === "speed-post") {
      baseTariff = Math.round(baseTariff * 1.5)
    }

    const gstAmount = Math.round(baseTariff * 0.18)
    return {
      base_tariff: baseTariff,
      gst_amount: gstAmount,
      total_amount: baseTariff + gstAmount,
      chargeable_weight: weightGrams,
      delivery_type: isLocal ? "Local" : "Inter-city",
    }
  }

  /** Map a tracking event code to a normalized status string. */
  static mapEventCodeToStatus(eventCode: string): string {
    return EVENT_CODE_STATUS_MAP[eventCode] || "unknown"
  }
}
