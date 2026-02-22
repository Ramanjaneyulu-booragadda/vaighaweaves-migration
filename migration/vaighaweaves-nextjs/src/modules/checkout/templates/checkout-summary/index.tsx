import { formatINR } from "@lib/util/money"

interface CheckoutSummaryProps {
  cart: any
}

/**
 * Checkout order summary sidebar — shows line items + totals in INR.
 */
export default function CheckoutSummary({ cart }: CheckoutSummaryProps) {
  const items: any[] = cart?.items ?? []
  const subtotal = formatINR(cart?.subtotal ?? 0)
  const shippingTotal =
    cart?.shipping_total != null ? formatINR(cart.shipping_total) : null
  const total = formatINR(cart?.total ?? 0)

  return (
    <div className="lg:sticky lg:top-12">
      <div className="bg-white border border-gray-200 rounded-md p-6 flex flex-col gap-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Order Summary</h2>

        <ul className="divide-y divide-gray-100">
          {items.map((item: any) => (
            <li key={item.id} className="flex gap-x-3 py-3">
              {item.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnail}
                  alt={item.product_title ?? item.title ?? ""}
                  className="w-12 h-12 object-cover rounded-md flex-shrink-0"
                />
              )}
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {item.product_title ?? item.title}
                </span>
                {item.variant_title && (
                  <span className="text-xs text-gray-500">
                    {item.variant_title}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  Qty: {item.quantity}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-900 flex-shrink-0">
                {formatINR(item.total ?? (item.unit_price * item.quantity ?? 0))}
              </span>
            </li>
          ))}
        </ul>

        <div className="border-t border-gray-200 pt-4 flex flex-col gap-y-2 text-sm">
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
          <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-200">
            <span>Total</span>
            <span>{total}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
