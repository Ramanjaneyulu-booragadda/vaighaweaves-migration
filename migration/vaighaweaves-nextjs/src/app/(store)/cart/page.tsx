import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { formatINR } from "@lib/util/money"

export const metadata: Metadata = {
  title: "Cart — VaighaWeaves",
  description: "Review your cart and proceed to checkout",
}

export default async function CartPage() {
  const cart = await retrieveCart()

  if (!cart) {
    return notFound()
  }

  const customer = await retrieveCustomer()

  const isEmpty = !cart.items || cart.items.length === 0

  return (
    <div className="py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Your Cart
        </h1>

        {isEmpty ? (
          <EmptyCart />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
            {/* Items */}
            <div className="flex flex-col gap-y-4">
              {!customer && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-sm text-amber-800">
                  <Link href="/login" className="font-semibold underline">
                    Sign in
                  </Link>{" "}
                  to access your saved addresses and track orders.
                </div>
              )}

              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                {cart.items.map((item: any) => (
                  <CartItem key={item.id} item={item} />
                ))}
              </ul>
            </div>

            {/* Summary */}
            <div className="lg:sticky lg:top-12">
              <CartSummary cart={cart} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-y-4 text-center">
      <span className="text-5xl">🛒</span>
      <h2 className="text-xl font-semibold text-gray-700">
        Your cart is empty
      </h2>
      <p className="text-gray-500 text-sm">
        Looks like you haven't added anything yet.
      </p>
      <Link
        href="/shop"
        className="mt-4 px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md font-medium transition-colors"
      >
        Shop Now
      </Link>
    </div>
  )
}

function CartItem({ item }: { item: any }) {
  const price = formatINR(item.unit_price ?? 0)

  return (
    <li className="flex gap-4 p-4">
      {item.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnail}
          alt={item.product_title ?? item.title ?? "Product"}
          className="w-20 h-20 object-cover rounded-md flex-shrink-0"
        />
      )}
      <div className="flex flex-col flex-1 min-w-0">
        <span className="font-medium text-gray-900 truncate">
          {item.product_title ?? item.title}
        </span>
        {item.variant_title && (
          <span className="text-sm text-gray-500">{item.variant_title}</span>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-sm text-gray-600">
            {price} × {item.quantity}
          </span>
          <span className="font-semibold text-gray-900">{formatINR(item.total ?? (item.unit_price * item.quantity ?? 0))}</span>
        </div>
      </div>
    </li>
  )
}

function CartSummary({ cart }: { cart: any }) {
  const subtotal = formatINR(cart.subtotal ?? 0)
  const shippingTotal = cart.shipping_total != null
    ? formatINR(cart.shipping_total)
    : null
  const total = formatINR(cart.total ?? 0)

  // Determine the first incomplete checkout step
  function getCheckoutStep(c: any) {
    if (!c?.shipping_address?.address_1 || !c.email) return "address"
    if (!c?.shipping_methods?.length) return "delivery"
    return "payment"
  }

  const step = getCheckoutStep(cart)

  return (
    <div className="border border-gray-200 rounded-md p-6 flex flex-col gap-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Order Summary</h2>

      <div className="flex flex-col gap-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal</span>
          <span className="text-gray-900">{subtotal}</span>
        </div>
        {shippingTotal !== null && (
          <div className="flex justify-between">
            <span className="text-gray-600">Shipping</span>
            <span className="text-gray-900">{shippingTotal}</span>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 pt-4 flex justify-between font-semibold text-gray-900">
        <span>Total</span>
        <span>{total}</span>
      </div>

      <Link
        href={`/checkout?step=${step}`}
        data-testid="checkout-button"
        className="mt-2 block w-full text-center py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-md transition-colors"
      >
        Proceed to Checkout
      </Link>
    </div>
  )
}
