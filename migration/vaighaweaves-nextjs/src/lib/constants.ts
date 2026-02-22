import React from "react"

/**
 * Map of Medusa payment provider IDs to display info.
 * Add or remove entries to match the providers configured in your Medusa backend.
 */
export const paymentInfoMap: Record<
  string,
  { title: string; icon: React.ReactNode }
> = {
  pp_razorpay_razorpay: {
    title: "Razorpay (Cards, UPI, Netbanking)",
    icon: React.createElement("span", { className: "text-brand-600 font-bold text-xs" }, "₹"),
  },
  pp_manual_manual: {
    title: "Manual Payment (In-store)",
    icon: React.createElement("span", { className: "text-gray-500 text-xs" }, "₹"),
  },
  pp_system_default: {
    title: "Manual Payment",
    icon: React.createElement("span", { className: "text-gray-500 text-xs" }, "₹"),
  },
}

/** Returns true for the Razorpay provider */
export const isRazorpay = (providerId?: string): boolean => {
  return !!providerId?.startsWith("pp_razorpay")
}

/** Returns true for manual / in-store payment providers */
export const isManual = (providerId?: string): boolean => {
  return (
    !!providerId?.startsWith("pp_manual") ||
    !!providerId?.startsWith("pp_system_default")
  )
}
