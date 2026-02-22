"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useState, useCallback } from "react"
import PaymentContainer from "@modules/checkout/components/payment-container"
import { paymentInfoMap } from "@lib/constants"

interface CheckoutFormProps {
  cart: any
  customer: any
}

/**
 * Multi-step checkout form: address → shipping → payment → review.
 *
 * The active step is controlled by the `?step=` search param so users can
 * share/bookmark a specific step and navigate back without losing progress.
 */
export default function CheckoutForm({ cart, customer }: CheckoutFormProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const currentStep = (searchParams.get("step") as CheckoutStep) ?? "address"

  const setStep = useCallback(
    (step: CheckoutStep) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("step", step)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [searchParams, router, pathname]
  )

  return (
    <div className="w-full flex flex-col gap-y-8">
      {/* Step 1 — Address */}
      <AddressStep
        cart={cart}
        customer={customer}
        isOpen={currentStep === "address"}
        onComplete={() => setStep("delivery")}
      />

      {/* Step 2 — Shipping */}
      <ShippingStep
        cart={cart}
        isOpen={currentStep === "delivery"}
        onComplete={() => setStep("payment")}
        onEdit={() => setStep("address")}
      />

      {/* Step 3 — Payment */}
      <PaymentStep
        cart={cart}
        isOpen={currentStep === "payment"}
        onComplete={() => setStep("review")}
        onEdit={() => setStep("delivery")}
      />

      {/* Step 4 — Review */}
      <ReviewStep
        cart={cart}
        isOpen={currentStep === "review"}
        onEdit={() => setStep("payment")}
      />
    </div>
  )
}

type CheckoutStep = "address" | "delivery" | "payment" | "review"

// ─── Step: Address ───────────────────────────────────────────────────────────

function AddressStep({
  cart,
  customer,
  isOpen,
  onComplete,
}: {
  cart: any
  customer: any
  isOpen: boolean
  onComplete: () => void
}) {
  const [email, setEmail] = useState(cart?.email ?? customer?.email ?? "")
  const [firstName, setFirstName] = useState(
    cart?.shipping_address?.first_name ?? customer?.first_name ?? ""
  )
  const [lastName, setLastName] = useState(
    cart?.shipping_address?.last_name ?? customer?.last_name ?? ""
  )
  const [address1, setAddress1] = useState(
    cart?.shipping_address?.address_1 ?? ""
  )
  const [city, setCity] = useState(cart?.shipping_address?.city ?? "")
  const [postalCode, setPostalCode] = useState(
    cart?.shipping_address?.postal_code ?? ""
  )
  const [phone, setPhone] = useState(
    cart?.shipping_address?.phone ?? customer?.phone ?? ""
  )

  const isComplete =
    !!cart?.shipping_address?.address_1 && !!cart?.email

  return (
    <StepWrapper
      step={1}
      title="Shipping Address"
      isOpen={isOpen}
      isComplete={isComplete}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="+91 9876543210"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First name
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last name
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address
          </label>
          <input
            type="text"
            value={address1}
            onChange={(e) => setAddress1(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Street, building, apartment…"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Postal code
          </label>
          <input
            type="text"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onComplete}
        disabled={!email || !address1}
        className="mt-4 px-6 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-md font-medium text-sm transition-colors"
      >
        Continue to Shipping
      </button>
    </StepWrapper>
  )
}

// ─── Step: Shipping ──────────────────────────────────────────────────────────

function ShippingStep({
  cart,
  isOpen,
  onComplete,
  onEdit,
}: {
  cart: any
  isOpen: boolean
  onComplete: () => void
  onEdit: () => void
}) {
  const hasShipping = (cart?.shipping_methods?.length ?? 0) > 0
  const isComplete = hasShipping

  return (
    <StepWrapper
      step={2}
      title="Shipping Method"
      isOpen={isOpen}
      isComplete={isComplete}
      onEdit={isComplete && !isOpen ? onEdit : undefined}
    >
      {isOpen && (
        <div className="text-sm text-gray-600 mb-4">
          Shipping options will be loaded from Medusa based on your region and
          address. Connect your Medusa backend to see live rates.
        </div>
      )}

      {isComplete && !isOpen && (
        <p className="text-sm text-gray-600">
          {cart.shipping_methods?.[0]?.name ?? "Shipping method selected"}
        </p>
      )}

      {isOpen && (
        <button
          type="button"
          onClick={onComplete}
          className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md font-medium text-sm transition-colors"
        >
          Continue to Payment
        </button>
      )}
    </StepWrapper>
  )
}

// ─── Step: Payment ───────────────────────────────────────────────────────────

function PaymentStep({
  cart,
  isOpen,
  onComplete,
  onEdit,
}: {
  cart: any
  isOpen: boolean
  onComplete: () => void
  onEdit: () => void
}) {
  const activeSession = cart?.payment_collection?.payment_sessions?.find(
    (s: any) => s.status === "pending"
  )

  const [selectedProvider, setSelectedProvider] = useState<string>(
    activeSession?.provider_id ?? ""
  )

  const isComplete = !!activeSession
  const availableProviders = Object.keys(paymentInfoMap)

  return (
    <StepWrapper
      step={3}
      title="Payment"
      isOpen={isOpen}
      isComplete={isComplete}
      onEdit={isComplete && !isOpen ? onEdit : undefined}
    >
      {isOpen && (
        <>
          <div className="flex flex-col gap-y-2">
            {availableProviders.map((providerId) => (
              <div
                key={providerId}
                onClick={() => setSelectedProvider(providerId)}
                className="cursor-pointer"
              >
                <PaymentContainer
                  paymentProviderId={providerId}
                  selectedPaymentOptionId={selectedProvider}
                  cart={cart}
                  activeSession={
                    activeSession?.provider_id === providerId
                      ? activeSession
                      : undefined
                  }
                />
              </div>
            ))}
          </div>

          {/* The Continue button only shows for non-Razorpay providers;
              Razorpay triggers its own modal via the button inside PaymentContainer. */}
          {selectedProvider && selectedProvider !== "pp_razorpay_razorpay" && (
            <button
              type="button"
              onClick={onComplete}
              className="mt-4 px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md font-medium text-sm transition-colors"
            >
              Continue to Review
            </button>
          )}
        </>
      )}

      {isComplete && !isOpen && (
        <p className="text-sm text-gray-600">
          {paymentInfoMap[activeSession?.provider_id]?.title ??
            activeSession?.provider_id}
        </p>
      )}
    </StepWrapper>
  )
}

// ─── Step: Review ────────────────────────────────────────────────────────────

function ReviewStep({
  cart,
  isOpen,
  onEdit,
}: {
  cart: any
  isOpen: boolean
  onEdit: () => void
}) {
  if (!isOpen) return null

  return (
    <StepWrapper step={4} title="Review Order" isOpen={isOpen} isComplete={false}>
      <div className="text-sm text-gray-700 flex flex-col gap-y-2">
        <div>
          <span className="font-medium">Ship to: </span>
          {[
            cart?.shipping_address?.address_1,
            cart?.shipping_address?.city,
            cart?.shipping_address?.postal_code,
          ]
            .filter(Boolean)
            .join(", ")}
        </div>
        <div>
          <span className="font-medium">Items: </span>
          {cart?.items?.length ?? 0} item(s)
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Your payment will be processed via the selected payment method above.
      </p>
    </StepWrapper>
  )
}

// ─── Step wrapper UI ─────────────────────────────────────────────────────────

function StepWrapper({
  step,
  title,
  isOpen,
  isComplete,
  onEdit,
  children,
}: {
  step: number
  title: string
  isOpen: boolean
  isComplete: boolean
  onEdit?: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-x-3">
          <span
            className={[
              "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold",
              isComplete
                ? "bg-green-500 text-white"
                : isOpen
                ? "bg-brand-600 text-white"
                : "bg-gray-200 text-gray-600",
            ].join(" ")}
          >
            {isComplete ? "✓" : step}
          </span>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Edit
          </button>
        )}
      </div>
      {(isOpen || isComplete) && children}
    </div>
  )
}
