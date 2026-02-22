"use client"

import React from "react"
import { isRazorpay, isManual, paymentInfoMap } from "@lib/constants"
import { RazorpayPayment } from "@modules/checkout/components/payment-providers/razorpay"
import { CodPayment } from "@modules/checkout/components/payment-providers/cod"

interface PaymentContainerProps {
  /** Medusa payment provider ID, e.g. "pp_razorpay_razorpay" */
  paymentProviderId: string
  /** The currently selected provider ID */
  selectedPaymentOptionId: string | null
  /** The cart object (needed by Razorpay modal) */
  cart?: any
  /** The active payment session (needed by Razorpay modal) */
  activeSession?: any
  disabled?: boolean
}

/**
 * PaymentContainer — wraps a single payment provider option in a selectable
 * radio-style card.  Renders the provider-specific UI (e.g. Razorpay button)
 * when the option is selected.
 */
const PaymentContainer: React.FC<PaymentContainerProps> = ({
  paymentProviderId,
  selectedPaymentOptionId,
  cart,
  activeSession,
  disabled = false,
}) => {
  const isSelected = selectedPaymentOptionId === paymentProviderId
  const info = paymentInfoMap[paymentProviderId]

  return (
    <div
      className={[
        "flex flex-col gap-y-2 text-sm cursor-pointer py-4 border rounded-md px-4 mb-2",
        "transition-shadow duration-150",
        isSelected
          ? "border-brand-600 shadow-sm"
          : "border-gray-200 hover:border-brand-300",
        disabled ? "opacity-50 pointer-events-none" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-selected={isSelected}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-3">
          {/* Simple radio indicator */}
          <span
            className={[
              "w-4 h-4 rounded-full border-2 flex-shrink-0",
              isSelected ? "border-brand-600 bg-brand-600" : "border-gray-400",
            ].join(" ")}
            aria-hidden
          />
          <span className="font-medium">
            {info?.title ?? paymentProviderId}
          </span>
        </div>
        <span className="text-gray-500">{info?.icon}</span>
      </div>

      {/* Provider-specific UI rendered only when selected */}
      {isSelected && (
        <div className="mt-3">
          {isRazorpay(paymentProviderId) && cart && activeSession ? (
            <RazorpayPayment cart={cart} session={activeSession} />
          ) : isManual(paymentProviderId) ? (
            <CodPayment />
          ) : null}
        </div>
      )}
    </div>
  )
}

export default PaymentContainer
