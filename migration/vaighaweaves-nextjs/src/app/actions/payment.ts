"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "@lib/session"

interface VerifyRazorpayPaymentInput {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
  cart_id: string
}

interface VerifyRazorpayPaymentResult {
  success: boolean
  order_id?: string
  error?: string
}

/**
 * Server Action — verifies the Razorpay payment signature and completes the
 * Medusa payment session.
 *
 * Signature verification happens here on the server, never in the client,
 * to prevent tampering with payment results.
 */
export async function verifyRazorpayPayment(
  data: VerifyRazorpayPaymentInput
): Promise<VerifyRazorpayPaymentResult> {
  try {
    const headers = await getAuthHeaders()

    // Retrieve the cart to get the payment collection ID
    const cartResponse = await sdk.client.fetch<{ cart: any }>(
      `/store/carts/${data.cart_id}`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      }
    )
    const cart = cartResponse.cart

    if (!cart) {
      return { success: false, error: "Cart not found" }
    }

    const paymentCollectionId = cart.payment_collection?.id
    if (!paymentCollectionId) {
      return { success: false, error: "No payment collection found" }
    }

    // Get the active payment session
    const activeSession = cart.payment_collection?.payment_sessions?.find(
      (s: any) => s.status === "pending"
    )
    if (!activeSession) {
      return { success: false, error: "No active payment session" }
    }

    // Complete the payment session — Medusa's Razorpay provider verifies the
    // signature server-side using the RAZORPAY_KEY_SECRET environment variable.
    const result = await sdk.client.fetch<{ payment_collection: any }>(
      `/store/payment-collections/${paymentCollectionId}/sessions/${activeSession.id}/complete`,
      {
        method: "POST",
        headers,
        body: {
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
        },
        cache: "no-store",
      }
    )

    if (result.payment_collection?.status === "authorized") {
      // Complete the cart to create an order
      const orderResult = await sdk.client.fetch<{ order: any }>(
        `/store/carts/${data.cart_id}/complete`,
        {
          method: "POST",
          headers,
          cache: "no-store",
        }
      )

      const order = orderResult.order
      if (order?.id) {
        return { success: true, order_id: order.id }
      }
    }

    return { success: false, error: "Payment not authorized" }
  } catch (err: any) {
    console.error("[verifyRazorpayPayment]", err)
    return { success: false, error: err?.message ?? "Unknown error" }
  }
}
