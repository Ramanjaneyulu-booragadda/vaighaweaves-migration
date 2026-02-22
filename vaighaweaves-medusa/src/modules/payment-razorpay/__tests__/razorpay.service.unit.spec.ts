/**
 * Unit tests for RazorpayProviderService
 *
 * Mocks the Razorpay SDK and tests all AbstractPaymentProvider methods.
 */

import crypto from "crypto"

// ─────────────────────────────────────────────────────────────────────────────
// Mock Razorpay SDK
// ─────────────────────────────────────────────────────────────────────────────

const mockOrdersCreate = jest.fn()
const mockPaymentsCapture = jest.fn()
const mockPaymentsRefund = jest.fn()
const mockPaymentsFetch = jest.fn()

jest.mock("razorpay", () => {
  return jest.fn().mockImplementation(() => ({
    orders: { create: mockOrdersCreate },
    payments: {
      capture: mockPaymentsCapture,
      refund: mockPaymentsRefund,
      fetch: mockPaymentsFetch,
    },
  }))
})

// ─────────────────────────────────────────────────────────────────────────────
// Import after mock
// ─────────────────────────────────────────────────────────────────────────────

import RazorpayProviderService from "../service"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS = {
  key_id: "rzp_test_abc123",
  key_secret: "secret_xyz789",
  webhook_secret: "whsec_test_000",
  auto_capture: true,
}

function createService(optionOverrides = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...optionOverrides }
  return new RazorpayProviderService({} as any, opts)
}

function makeSignature(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex")
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("RazorpayProviderService", () => {
  let service: RazorpayProviderService

  beforeEach(() => {
    jest.clearAllMocks()
    service = createService()
  })

  // ─── initiatePayment ────────────────────────────────────────────────────

  describe("initiatePayment", () => {
    it("creates a Razorpay order and returns session data", async () => {
      mockOrdersCreate.mockResolvedValue({
        id: "order_TestOrder123",
        amount: 109900,
        currency: "INR",
      })

      const result = await service.initiatePayment({
        amount: 1099,
        currency_code: "inr",
        context: { idempotency_key: "idem_123" },
      } as any)

      expect(mockOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 109900,
          currency: "INR",
          receipt: "idem_123",
        })
      )
      expect(result.id).toBe("order_TestOrder123")
      expect((result.data as any).razorpay_order_id).toBe("order_TestOrder123")
      expect((result.data as any).amount_in_paise).toBe(109900)
      expect((result.data as any).currency).toBe("INR")
    })

    it("handles Razorpay API error", async () => {
      mockOrdersCreate.mockRejectedValue(new Error("Razorpay API down"))

      await expect(
        service.initiatePayment({
          amount: 500,
          currency_code: "inr",
          context: {},
        } as any)
      ).rejects.toThrow("Razorpay API down")
    })

    it("includes customer info in notes when provided", async () => {
      mockOrdersCreate.mockResolvedValue({
        id: "order_WithCustomer",
        amount: 50000,
        currency: "INR",
      })

      await service.initiatePayment({
        amount: 500,
        currency_code: "inr",
        context: {
          customer: { id: "cust_001", email: "test@example.com" },
        },
      } as any)

      expect(mockOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: expect.objectContaining({
            customer_id: "cust_001",
            customer_email: "test@example.com",
          }),
        })
      )
    })
  })

  // ─── authorizePayment ───────────────────────────────────────────────────

  describe("authorizePayment", () => {
    it("verifies valid signature and returns 'captured' (auto_capture=true)", async () => {
      const orderId = "order_Auth123"
      const paymentId = "pay_Auth456"
      const body = `${orderId}|${paymentId}`
      const signature = makeSignature(body, DEFAULT_OPTIONS.key_secret)

      const result = await service.authorizePayment({
        data: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          amount_in_paise: 50000,
          currency: "INR",
        },
      } as any)

      expect(result.status).toBe("captured")
      expect((result.data as any).razorpay_payment_id).toBe(paymentId)
    })

    it("returns 'authorized' when auto_capture=false", async () => {
      const svc = createService({ auto_capture: false })
      const orderId = "order_Manual123"
      const paymentId = "pay_Manual456"
      const body = `${orderId}|${paymentId}`
      const signature = makeSignature(body, DEFAULT_OPTIONS.key_secret)

      const result = await svc.authorizePayment({
        data: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          amount_in_paise: 50000,
          currency: "INR",
        },
      } as any)

      expect(result.status).toBe("authorized")
    })

    it("throws on invalid signature", async () => {
      await expect(
        service.authorizePayment({
          data: {
            razorpay_order_id: "order_Bad",
            razorpay_payment_id: "pay_Bad",
            razorpay_signature: "invalid_signature_abc",
            amount_in_paise: 50000,
            currency: "INR",
          },
        } as any)
      ).rejects.toThrow("Invalid Razorpay payment signature")
    })

    it("throws when payment_id or signature is missing", async () => {
      await expect(
        service.authorizePayment({
          data: {
            razorpay_order_id: "order_NoPay",
            amount_in_paise: 50000,
            currency: "INR",
          },
        } as any)
      ).rejects.toThrow(
        "razorpay_payment_id and razorpay_signature are required"
      )
    })
  })

  // ─── capturePayment ─────────────────────────────────────────────────────

  describe("capturePayment", () => {
    it("captures payment with correct amount", async () => {
      mockPaymentsCapture.mockResolvedValue({
        id: "pay_Cap123",
        captured_at: 1700000000,
        method: "upi",
      })

      const result = await service.capturePayment({
        data: {
          razorpay_payment_id: "pay_Cap123",
          amount_in_paise: 109900,
          currency: "INR",
        },
      } as any)

      expect(mockPaymentsCapture).toHaveBeenCalledWith(
        "pay_Cap123",
        109900,
        "INR"
      )
      expect((result.data as any).captured_at).toBe(1700000000)
      expect((result.data as any).method).toBe("upi")
    })

    it("throws when payment_id is missing", async () => {
      await expect(
        service.capturePayment({
          data: { amount_in_paise: 50000, currency: "INR" },
        } as any)
      ).rejects.toThrow("razorpay_payment_id is required to capture")
    })
  })

  // ─── refundPayment ──────────────────────────────────────────────────────

  describe("refundPayment", () => {
    it("creates a full refund", async () => {
      mockPaymentsRefund.mockResolvedValue({
        id: "rfnd_Full123",
        amount: 109900,
      })

      const result = await service.refundPayment({
        data: {
          razorpay_payment_id: "pay_Refund123",
          amount_in_paise: 109900,
          currency: "INR",
        },
        amount: 1099,
      } as any)

      expect(mockPaymentsRefund).toHaveBeenCalledWith("pay_Refund123", {
        amount: 109900,
        speed: "normal",
      })
      expect((result.data as any).last_refund_id).toBe("rfnd_Full123")
      expect((result.data as any).last_refund_amount).toBe(109900)
    })

    it("creates a partial refund with specific amount", async () => {
      mockPaymentsRefund.mockResolvedValue({
        id: "rfnd_Partial123",
        amount: 50000,
      })

      await service.refundPayment({
        data: {
          razorpay_payment_id: "pay_PartialRefund",
          amount_in_paise: 109900,
          currency: "INR",
        },
        amount: 500,
      } as any)

      expect(mockPaymentsRefund).toHaveBeenCalledWith("pay_PartialRefund", {
        amount: 50000,
        speed: "normal",
      })
    })

    it("throws when payment_id is missing", async () => {
      await expect(
        service.refundPayment({
          data: { amount_in_paise: 50000 },
          amount: 500,
        } as any)
      ).rejects.toThrow("razorpay_payment_id is required to refund")
    })
  })

  // ─── getPaymentStatus ──────────────────────────────────────────────────

  describe("getPaymentStatus", () => {
    it("maps 'captured' → 'captured'", async () => {
      mockPaymentsFetch.mockResolvedValue({ status: "captured" })

      const result = await service.getPaymentStatus({
        data: { razorpay_payment_id: "pay_Status1" },
      } as any)

      expect(result.status).toBe("captured")
    })

    it("maps 'authorized' → 'authorized'", async () => {
      mockPaymentsFetch.mockResolvedValue({ status: "authorized" })

      const result = await service.getPaymentStatus({
        data: { razorpay_payment_id: "pay_Status2" },
      } as any)

      expect(result.status).toBe("authorized")
    })

    it("maps 'failed' → 'error'", async () => {
      mockPaymentsFetch.mockResolvedValue({ status: "failed" })

      const result = await service.getPaymentStatus({
        data: { razorpay_payment_id: "pay_Status3" },
      } as any)

      expect(result.status).toBe("error")
    })

    it("returns 'pending' when no payment_id", async () => {
      const result = await service.getPaymentStatus({
        data: { razorpay_order_id: "order_NoPay" },
      } as any)

      expect(result.status).toBe("pending")
      expect(mockPaymentsFetch).not.toHaveBeenCalled()
    })
  })

  // ─── getWebhookActionAndData ───────────────────────────────────────────

  describe("getWebhookActionAndData", () => {
    function makeWebhookPayload(
      eventType: string,
      paymentEntity: Record<string, any>,
      validSignature = true
    ) {
      const rawData = JSON.stringify({
        event: eventType,
        payload: { payment: { entity: paymentEntity } },
      })

      const signature = validSignature
        ? makeSignature(rawData, DEFAULT_OPTIONS.webhook_secret)
        : "bad_signature"

      return {
        data: JSON.parse(rawData),
        rawData,
        headers: { "x-razorpay-signature": signature },
      }
    }

    it("handles payment.captured event", async () => {
      const payload = makeWebhookPayload("payment.captured", {
        order_id: "order_WH1",
        amount: 109900,
      })

      const result = await service.getWebhookActionAndData(payload as any)

      expect(result.action).toBe("captured")
      expect(result.data.session_id).toBe("order_WH1")
    })

    it("handles payment.authorized event", async () => {
      const payload = makeWebhookPayload("payment.authorized", {
        order_id: "order_WH2",
        amount: 50000,
      })

      const result = await service.getWebhookActionAndData(payload as any)

      expect(result.action).toBe("authorized")
      expect(result.data.session_id).toBe("order_WH2")
    })

    it("handles payment.failed event", async () => {
      const payload = makeWebhookPayload("payment.failed", {
        order_id: "order_WH3",
        amount: 75000,
      })

      const result = await service.getWebhookActionAndData(payload as any)

      expect(result.action).toBe("failed")
      expect(result.data.session_id).toBe("order_WH3")
    })

    it("returns 'not_supported' for unknown event types", async () => {
      const payload = makeWebhookPayload("refund.processed", {
        order_id: "order_WH4",
        amount: 10000,
      })

      const result = await service.getWebhookActionAndData(payload as any)

      expect(result.action).toBe("not_supported")
    })

    it("returns 'failed' on invalid webhook signature", async () => {
      const payload = makeWebhookPayload(
        "payment.captured",
        { order_id: "order_WHBad", amount: 50000 },
        false
      )

      const result = await service.getWebhookActionAndData(payload as any)

      expect(result.action).toBe("failed")
    })
  })

  // ─── updatePayment ─────────────────────────────────────────────────────

  describe("updatePayment", () => {
    it("returns existing data when amount unchanged", async () => {
      const sessionData = {
        razorpay_order_id: "order_NoChange",
        amount_in_paise: 109900,
        currency: "INR",
      }

      const result = await service.updatePayment({
        amount: 1099,
        currency_code: "inr",
        data: sessionData,
        context: {},
      } as any)

      expect(mockOrdersCreate).not.toHaveBeenCalled()
      expect((result.data as any).razorpay_order_id).toBe("order_NoChange")
    })

    it("creates new order when amount changed", async () => {
      mockOrdersCreate.mockResolvedValue({
        id: "order_Updated456",
        amount: 150000,
        currency: "INR",
      })

      const result = await service.updatePayment({
        amount: 1500,
        currency_code: "inr",
        data: {
          razorpay_order_id: "order_OldAmount",
          amount_in_paise: 109900,
          currency: "INR",
        },
        context: {},
      } as any)

      expect(mockOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 150000 })
      )
      expect((result.data as any).razorpay_order_id).toBe("order_Updated456")
    })
  })

  // ─── cancelPayment / deletePayment ─────────────────────────────────────

  describe("cancelPayment", () => {
    it("returns input data unchanged (no-op)", async () => {
      const data = { razorpay_order_id: "order_Cancel" }
      const result = await service.cancelPayment({ data } as any)
      expect(result.data).toEqual(data)
    })
  })

  describe("deletePayment", () => {
    it("returns input data unchanged (no-op)", async () => {
      const data = { razorpay_order_id: "order_Delete" }
      const result = await service.deletePayment({ data } as any)
      expect(result.data).toEqual(data)
    })
  })

  // ─── retrievePayment ───────────────────────────────────────────────────

  describe("retrievePayment", () => {
    it("fetches payment details from Razorpay", async () => {
      mockPaymentsFetch.mockResolvedValue({
        status: "captured",
        method: "card",
        email: "customer@test.com",
        contact: "+919876543210",
      })

      const result = await service.retrievePayment({
        data: {
          razorpay_payment_id: "pay_Retrieve1",
          razorpay_order_id: "order_Retrieve1",
          amount_in_paise: 50000,
          currency: "INR",
        },
      } as any)

      expect(mockPaymentsFetch).toHaveBeenCalledWith("pay_Retrieve1")
      expect((result.data as any).razorpay_status).toBe("captured")
      expect((result.data as any).method).toBe("card")
      expect((result.data as any).email).toBe("customer@test.com")
    })

    it("returns input data when no payment_id exists", async () => {
      const data = { razorpay_order_id: "order_NoPay" }
      const result = await service.retrievePayment({ data } as any)

      expect(mockPaymentsFetch).not.toHaveBeenCalled()
      expect(result.data).toEqual(data)
    })
  })

  // ─── validateOptions ───────────────────────────────────────────────────

  describe("validateOptions", () => {
    it("throws when key_id is missing", () => {
      expect(() =>
        RazorpayProviderService.validateOptions({
          key_secret: "secret",
        })
      ).toThrow("Razorpay key_id is required")
    })

    it("throws when key_secret is missing", () => {
      expect(() =>
        RazorpayProviderService.validateOptions({
          key_id: "rzp_test",
        })
      ).toThrow("Razorpay key_secret is required")
    })
  })
})
