import { Metadata } from "next"
import { notFound } from "next/navigation"
import { retrieveOrder } from "@lib/data/orders"
import { formatINR } from "@lib/util/money"
import CancelOrderButton from "./cancel-button"

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params
  const order = await retrieveOrder(id)
  return {
    title: order ? `Order #${order.display_id} — VaighaWeaves` : "Order Not Found",
    description: "View your order details",
  }
}

/**
 * Order detail page — Server Component.
 * Includes items, shipping address, tracking info, and a cancel button.
 */
export default async function OrderDetailPage(props: Props) {
  const { id } = await props.params
  const order = await retrieveOrder(id)

  if (!order) {
    return notFound()
  }

  return (
    <div className="py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Order #{order.display_id}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Placed on{" "}
              {new Date(order.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="flex items-center gap-x-4">
            <OrderStatusBadge status={order.status} />
            {order.status === "pending" && (
              <CancelOrderButton orderId={order.id} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Order items */}
          <section className="bg-white border border-gray-200 rounded-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Items</h2>
            <ul className="divide-y divide-gray-100">
              {order.items?.map((item: any) => (
                <li key={item.id} className="flex gap-x-4 py-3">
                  {item.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnail}
                      alt={item.product_title ?? item.title ?? ""}
                      className="w-14 h-14 object-cover rounded-md flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.product_title ?? item.title}
                    </p>
                    {item.variant_title && (
                      <p className="text-xs text-gray-500">{item.variant_title}</p>
                    )}
                    <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {formatINR(item.total ?? (item.unit_price * item.quantity ?? 0))}
                  </span>
                </li>
              ))}
            </ul>

            {/* Totals */}
            <div className="border-t border-gray-200 mt-4 pt-4 flex flex-col gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatINR(order.subtotal ?? 0)}</span>
              </div>
              {order.shipping_total != null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Shipping</span>
                  <span>{formatINR(order.shipping_total)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>{formatINR(order.total ?? 0)}</span>
              </div>
            </div>
          </section>

          {/* Shipping address + tracking */}
          <div className="flex flex-col gap-y-6">
            <section className="bg-white border border-gray-200 rounded-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Shipping Address
              </h2>
              {order.shipping_address ? (
                <address className="text-sm text-gray-600 not-italic leading-relaxed">
                  {[
                    order.shipping_address.first_name,
                    order.shipping_address.last_name,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  <br />
                  {order.shipping_address.address_1}
                  {order.shipping_address.address_2 && (
                    <>
                      <br />
                      {order.shipping_address.address_2}
                    </>
                  )}
                  <br />
                  {order.shipping_address.city},{" "}
                  {order.shipping_address.postal_code}
                  {order.shipping_address.phone && (
                    <>
                      <br />
                      {order.shipping_address.phone}
                    </>
                  )}
                </address>
              ) : (
                <p className="text-sm text-gray-500">No address on file</p>
              )}
            </section>

            {/* Tracking */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Shipment Status
              </h2>
              {order.fulfillments && order.fulfillments.length > 0 ? (
                <ul className="flex flex-col gap-y-2">
                  {order.fulfillments.map((fulfillment: any, idx: number) => (
                    <li key={idx} className="text-sm text-gray-600">
                      <span className="font-medium">
                        {fulfillment.tracking_company ?? "Carrier"}
                      </span>
                      {fulfillment.tracking_number && (
                        <>
                          {" "}
                          —{" "}
                          {fulfillment.tracking_url ? (
                            <a
                              href={fulfillment.tracking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-600 hover:underline"
                            >
                              {fulfillment.tracking_number}
                            </a>
                          ) : (
                            <span>{fulfillment.tracking_number}</span>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">
                  No tracking information yet.
                </p>
              )}
            </section>
          </div>
        </div>
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
