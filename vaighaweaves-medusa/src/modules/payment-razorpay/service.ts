/**
 * RazorpayProviderService
 *
 * Medusa v2 payment provider for Razorpay. Supports both auto-capture
 * and manual authorize-then-capture modes.
 *
 * Webhook URL: POST /api/hooks/payment/razorpay
 * Provider ID in DB: pp_razorpay_{config_id}
 */
import { AbstractPaymentProvider, BigNumber } from "@medusajs/framework/utils"
import type {
  InitiatePaymentInput,
  InitiatePaymentOutput,
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  RefundPaymentInput,
  RefundPaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types"
import crypto from "crypto"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RazorpayOptions = {
  key_id: string
  key_secret: string
  webhook_secret: string
  auto_capture?: boolean
}

interface RazorpaySessionData {
  razorpay_order_id: string
  razorpay_payment_id?: string
  razorpay_signature?: string
  amount_in_paise: number
  currency: string
  receipt?: string
  notes?: Record<string, string>
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

class RazorpayProviderService extends AbstractPaymentProvider<RazorpayOptions> {
  static identifier = "razorpay"

  protected options_: RazorpayOptions
  private razorpayClient: any = null

  constructor(container: Record<string, unknown>, options: RazorpayOptions) {
    super(container, options)
    this.options_ = options
  }

  static validateOptions(options: Record<any, any>): void {
    if (!options.key_id) {
      throw new Error("Razorpay key_id is required")
    }
    if (!options.key_secret) {
      throw new Error("Razorpay key_secret is required")
    }
  }

  /** Lazy-init Razorpay SDK client */
  private getClient(): any {
    if (!this.razorpayClient) {
      const Razorpay = require("razorpay")
      this.razorpayClient = new Razorpay({
        key_id: this.options_.key_id,
        key_secret: this.options_.key_secret,
      })
    }
    return this.razorpayClient
  }

  // ─────────────────────────────────────────────────────────────────────────
  // initiatePayment — Create Razorpay order
  // ─────────────────────────────────────────────────────────────────────────
  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const { amount, currency_code, context } = input
    const amountInPaise = Math.round(Number(amount) * 100)

    const orderOptions: Record<string, any> = {
      amount: amountInPaise,
      currency: (currency_code || "INR").toUpperCase(),
      receipt: context?.idempotency_key || `medusa_${Date.now()}`,
      notes: {} as Record<string, string>,
    }

    if (context?.customer) {
      const customer = context.customer as Record<string, any>
      orderOptions.notes.customer_id = customer.id || ""
      orderOptions.notes.customer_email = customer.email || ""
    }

    const client = this.getClient()
    const razorpayOrder = await client.orders.create(orderOptions)

    const sessionData: RazorpaySessionData = {
      razorpay_order_id: razorpayOrder.id,
      amount_in_paise: amountInPaise,
      currency: orderOptions.currency,
      receipt: orderOptions.receipt,
      notes: orderOptions.notes,
    }

    return {
      id: razorpayOrder.id,
      data: sessionData as unknown as Record<string, unknown>,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // authorizePayment — Verify Razorpay signature
  // ─────────────────────────────────────────────────────────────────────────
  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const data = input.data as unknown as RazorpaySessionData

    if (!data?.razorpay_payment_id || !data?.razorpay_signature) {
      throw new Error(
        "razorpay_payment_id and razorpay_signature are required for authorization"
      )
    }

    // Verify signature
    const body = `${data.razorpay_order_id}|${data.razorpay_payment_id}`
    const expectedSignature = crypto
      .createHmac("sha256", this.options_.key_secret)
      .update(body)
      .digest("hex")

    if (expectedSignature !== data.razorpay_signature) {
      throw new Error("Invalid Razorpay payment signature")
    }

    const autoCapture = this.options_.auto_capture !== false
    const status = autoCapture ? "captured" : "authorized"

    return {
      status,
      data: {
        ...data,
      } as unknown as Record<string, unknown>,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // capturePayment — Capture authorized payment (manual mode)
  // ─────────────────────────────────────────────────────────────────────────
  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    const data = input.data as unknown as RazorpaySessionData

    if (!data?.razorpay_payment_id) {
      throw new Error("razorpay_payment_id is required to capture")
    }

    const client = this.getClient()
    const captured = await client.payments.capture(
      data.razorpay_payment_id,
      data.amount_in_paise,
      data.currency || "INR"
    )

    return {
      data: {
        ...data,
        captured_at: captured.captured_at,
        method: captured.method,
      } as unknown as Record<string, unknown>,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // refundPayment
  // ─────────────────────────────────────────────────────────────────────────
  async refundPayment(
    input: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    const data = input.data as unknown as RazorpaySessionData

    if (!data?.razorpay_payment_id) {
      throw new Error("razorpay_payment_id is required to refund")
    }

    const refundAmountPaise = Math.round(Number(input.amount) * 100)

    const client = this.getClient()
    const refund = await client.payments.refund(data.razorpay_payment_id, {
      amount: refundAmountPaise,
      speed: "normal",
    })

    return {
      data: {
        ...data,
        last_refund_id: refund.id,
        last_refund_amount: refundAmountPaise,
      } as unknown as Record<string, unknown>,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // cancelPayment — Razorpay doesn't support pre-capture cancel
  // ─────────────────────────────────────────────────────────────────────────
  async cancelPayment(
    input: CancelPaymentInput
  ): Promise<CancelPaymentOutput> {
    return { data: input.data }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // deletePayment — Cleanup session
  // ─────────────────────────────────────────────────────────────────────────
  async deletePayment(
    input: DeletePaymentInput
  ): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // updatePayment — Recreate order if amount changed
  // ─────────────────────────────────────────────────────────────────────────
  async updatePayment(
    input: UpdatePaymentInput
  ): Promise<UpdatePaymentOutput> {
    const { amount, currency_code, context } = input
    const newAmountPaise = Math.round(Number(amount) * 100)
    const data = input.data as unknown as RazorpaySessionData

    // If amount hasn't changed, return existing data
    if (data?.amount_in_paise === newAmountPaise) {
      return { data: input.data }
    }

    // Create a new Razorpay order with updated amount
    const result = await this.initiatePayment({
      amount,
      currency_code: currency_code || data?.currency || "INR",
      context,
    } as InitiatePaymentInput)

    return { data: result.data }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // retrievePayment — Fetch payment from Razorpay
  // ─────────────────────────────────────────────────────────────────────────
  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const data = input.data as unknown as RazorpaySessionData

    if (!data?.razorpay_payment_id) {
      return { data: input.data }
    }

    const client = this.getClient()
    const payment = await client.payments.fetch(data.razorpay_payment_id)

    return {
      data: {
        ...data,
        razorpay_status: payment.status,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
      } as unknown as Record<string, unknown>,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getPaymentStatus — Map Razorpay status to Medusa status
  // ─────────────────────────────────────────────────────────────────────────
  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const data = input.data as unknown as RazorpaySessionData

    if (!data?.razorpay_payment_id) {
      return { status: "pending" }
    }

    const client = this.getClient()
    const payment = await client.payments.fetch(data.razorpay_payment_id)

    const statusMap: Record<string, string> = {
      created: "pending",
      authorized: "authorized",
      captured: "captured",
      refunded: "captured", // refunded is still "captured" from payment perspective
      failed: "error",
    }

    return {
      status: (statusMap[payment.status] || "pending") as any,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getWebhookActionAndData — Handle Razorpay webhook events
  // ─────────────────────────────────────────────────────────────────────────
  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const { data, rawData, headers } = payload

    try {
      // Verify webhook signature
      if (this.options_.webhook_secret) {
        const signature =
          (headers as Record<string, string>)?.["x-razorpay-signature"] || ""
        const expectedSignature = crypto
          .createHmac("sha256", this.options_.webhook_secret)
          .update(rawData as string)
          .digest("hex")

        if (signature !== expectedSignature) {
          return {
            action: "failed",
            data: {
              session_id: "",
              amount: new BigNumber(0),
            },
          }
        }
      }

      const event = data as Record<string, any>
      const eventType = event.event as string
      const paymentEntity = event.payload?.payment?.entity

      if (!paymentEntity) {
        return {
          action: "not_supported",
          data: { session_id: "", amount: new BigNumber(0) },
        }
      }

      // session_id = razorpay_order_id (stored as session ID in initiatePayment)
      const sessionId = paymentEntity.order_id || ""
      const amountInRupees = (paymentEntity.amount || 0) / 100

      switch (eventType) {
        case "payment.authorized":
          return {
            action: "authorized",
            data: {
              session_id: sessionId,
              amount: new BigNumber(amountInRupees),
            },
          }

        case "payment.captured":
          return {
            action: "captured",
            data: {
              session_id: sessionId,
              amount: new BigNumber(amountInRupees),
            },
          }

        case "payment.failed":
          return {
            action: "failed",
            data: {
              session_id: sessionId,
              amount: new BigNumber(amountInRupees),
            },
          }

        default:
          return {
            action: "not_supported",
            data: { session_id: "", amount: new BigNumber(0) },
          }
      }
    } catch (err) {
      return {
        action: "failed",
        data: { session_id: "", amount: new BigNumber(0) },
      }
    }
  }
}

export default RazorpayProviderService
