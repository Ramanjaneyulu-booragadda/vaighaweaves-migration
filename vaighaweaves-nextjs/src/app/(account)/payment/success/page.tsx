import { Metadata } from "next"
import Link from "next/link"
import { retrieveOrder } from "@lib/data/orders"
import { formatINR } from "@lib/util/money"

export const metadata: Metadata = {
  title: "Payment Successful — VaighaWeaves",
  description: "Thank you for your order",
}

interface PaymentSuccessPageProps {
  searchParams: Promise<{ order_id?: string }>
}

/**
 * Payment Success page — Server Component.
 * Reads `order_id` from search params and displays an order confirmation.
 * Ported from vaighaweaves-ui/src/pages/PaymentSuccess.tsx.
 */
export default async function PaymentSuccessPage({
  searchParams,
}: PaymentSuccessPageProps) {
  const { order_id } = await searchParams

  const order = order_id ? await retrieveOrder(order_id) : null

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-16 px-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        {/* Success icon */}
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">✓</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Successful!
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          Thank you for shopping with VaighaWeaves. Your order has been placed
          and will be processed shortly.
        </p>

        {order && (
          <div className="bg-gray-50 rounded-md p-4 mb-6 text-left">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Order number</span>
              <span className="font-semibold text-gray-900">
                #{order.display_id}
              </span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Date</span>
              <span className="text-gray-900">
                {new Date(order.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Items</span>
              <span className="text-gray-900">
                {order.items?.length ?? 0} item(s)
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2 mt-2">
              <span className="text-gray-900">Total paid</span>
              <span className="text-gray-900">
                {formatINR(order.total ?? 0)}
              </span>
            </div>
          </div>
        )}

        {!order && order_id && (
          <p className="text-sm text-gray-500 mb-6">
            Order ID: <span className="font-mono">{order_id}</span>
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          {order && (
            <Link
              href={`/orders/${order.id}`}
              className="flex-1 py-2 border border-brand-600 text-brand-600 hover:bg-brand-50 rounded-md text-sm font-medium transition-colors"
            >
              View Order
            </Link>
          )}
          <Link
            href="/shop"
            className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
