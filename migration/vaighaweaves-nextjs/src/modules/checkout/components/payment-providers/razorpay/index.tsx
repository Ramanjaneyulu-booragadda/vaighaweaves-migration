"use client"

import Script from "next/script"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { verifyRazorpayPayment } from "@/app/actions/payment"

interface RazorpaySuccessResponse {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

interface RazorpayPaymentProps {
  /** The Medusa cart object */
  cart: any
  /** The active Medusa payment session (contains razorpay_order_id in session.data) */
  session: any
}

/**
 * RazorpayPayment — renders the "Pay with Razorpay" button and manages the
 * Razorpay checkout modal lifecycle.
 *
 * The Razorpay checkout.js script is loaded lazily only when this component
 * renders (i.e., only on the checkout page), never globally.
 *
 * Signature verification happens in a Server Action, never here.
 */
export function RazorpayPayment({ cart, session }: RazorpayPaymentProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handlePayment = () => {
    if (isProcessing) return
    setIsProcessing(true)
    setError(null)

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      // Amount is in paise (smallest INR unit), forwarded from Medusa session
      amount: session?.data?.amount,
      currency: "INR",
      order_id: session?.data?.razorpay_order_id,
      name: "VaighaWeaves",
      description: `Order #${cart?.id}`,
      handler: async (response: RazorpaySuccessResponse) => {
        const result = await verifyRazorpayPayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          cart_id: cart.id,
        })

        if (result.success) {
          router.push(`/payment/success?order_id=${result.order_id}`)
        } else {
          setError(
            result.error ?? "Payment verification failed. Please contact support."
          )
          setIsProcessing(false)
        }
      },
      modal: {
        ondismiss: () => setIsProcessing(false),
      },
      prefill: {
        name:
          [
            cart?.billing_address?.first_name,
            cart?.billing_address?.last_name,
          ]
            .filter(Boolean)
            .join(" ") || undefined,
        email: cart?.email || undefined,
        contact: cart?.billing_address?.phone || undefined,
      },
      theme: {
        // VaighaWeaves brand violet
        color: "#7c3aed",
      },
    }

    // window.Razorpay is injected by the lazily loaded checkout.js script
    const rzp = new (window as any).Razorpay(options)
    rzp.on("payment.failed", (response: any) => {
      setError(
        response?.error?.description ?? "Payment failed. Please try again."
      )
      setIsProcessing(false)
    })
    rzp.open()
  }

  return (
    <>
      {/* Lazily load Razorpay checkout.js only on this page */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <button
        type="button"
        onClick={handlePayment}
        disabled={isProcessing}
        className="w-full h-10 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors duration-150"
      >
        {isProcessing ? "Processing…" : "Pay with Razorpay"}
      </button>

      {error && (
        <p className="text-red-500 text-sm mt-2" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
