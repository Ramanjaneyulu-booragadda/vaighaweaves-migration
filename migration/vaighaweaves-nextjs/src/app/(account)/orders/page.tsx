import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getServerCustomer } from "@lib/session"
import { listOrders } from "@lib/data/orders"
import { formatINR } from "@lib/util/money"

// Always fetch fresh — these are the user's own orders
export const revalidate = 0

export const metadata: Metadata = {
  title: "My Orders — VaighaWeaves",
  description: "View all your past and current orders",
}

/**
 * Orders list page — Server Component.
 */
export default async function OrdersPage() {
  const customer = await getServerCustomer()

  if (!customer) {
    return notFound()
  }

  const orders = await listOrders(50)

  return (
    <div className="py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">My Orders</h1>

        {orders.length > 0 ? (
          <ul className="flex flex-col gap-y-4">
            {orders.map((order: any) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="block bg-white border border-gray-200 rounded-md p-4 hover:border-brand-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-y-1">
                      <span className="font-semibold text-gray-900">
                        Order #{order.display_id}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <div className="flex items-center gap-x-4">
                      <span className="text-sm font-medium text-gray-900">
                        {formatINR(order.total)}
                      </span>
                      <OrderStatusBadge status={order.status} />
                      <span className="text-gray-400">›</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">You haven't placed any orders yet.</p>
            <Link
              href="/shop"
              className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md font-medium text-sm transition-colors"
            >
              Start Shopping
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

function OrderStatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-800",
    canceled: "bg-red-100 text-red-800",
    archived: "bg-gray-100 text-gray-800",
  }
  const cls = colours[status] ?? "bg-gray-100 text-gray-700"

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}
    >
      {status}
    </span>
  )
}
