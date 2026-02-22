import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getServerCustomer } from "@lib/session"
import { listOrders } from "@lib/data/orders"
import { formatINR } from "@lib/util/money"

export const metadata: Metadata = {
  title: "Dashboard — VaighaWeaves",
  description: "Overview of your account activity",
}

/**
 * Dashboard page — Server Component.
 * Loads customer info and the 5 most recent orders.
 */
export default async function DashboardPage() {
  const customer = await getServerCustomer()

  if (!customer) {
    return notFound()
  }

  const recentOrders = await listOrders(5)

  return (
    <div data-testid="overview-page-wrapper" className="py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Welcome */}
        <div className="flex items-center justify-between mb-8">
          <h1
            className="text-2xl font-bold text-gray-900"
            data-testid="welcome-message"
            data-value={customer.first_name}
          >
            Hello, {customer.first_name}!
          </h1>
          <span className="text-sm text-gray-500">
            Signed in as{" "}
            <span
              className="font-semibold"
              data-testid="customer-email"
              data-value={customer.email}
            >
              {customer.email}
            </span>
          </span>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatCard label="Total Orders" value={recentOrders.length} />
          <StatCard
            label="Saved Addresses"
            value={customer.addresses?.length ?? 0}
          />
          <StatCard label="Wishlist Items" value="—" />
        </div>

        {/* Recent orders */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Orders
            </h2>
            <Link
              href="/orders"
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              View all
            </Link>
          </div>

          {recentOrders.length > 0 ? (
            <ul
              className="flex flex-col gap-y-3"
              data-testid="orders-wrapper"
            >
              {recentOrders.map((order: any) => (
                <li
                  key={order.id}
                  data-testid="order-wrapper"
                  data-value={order.id}
                >
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-md p-4 hover:border-brand-300 transition-colors"
                  >
                    <div className="grid grid-cols-3 text-sm flex-1">
                      <div>
                        <p className="font-medium text-gray-700">Date</p>
                        <p
                          className="text-gray-500"
                          data-testid="order-created-date"
                        >
                          {new Date(order.created_at).toLocaleDateString(
                            "en-IN"
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Order #</p>
                        <p
                          className="text-gray-500"
                          data-testid="order-id"
                          data-value={order.display_id}
                        >
                          #{order.display_id}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Total</p>
                        <p
                          className="text-gray-500"
                          data-testid="order-amount"
                        >
                          {formatINR(order.total)}
                        </p>
                      </div>
                    </div>
                    <span className="ml-4 text-gray-400">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p data-testid="no-orders-message" className="text-gray-500 text-sm">
              No recent orders
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-5 text-center">
      <p className="text-3xl font-bold text-brand-600">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  )
}
