import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Shipping Policy — VaighaWeaves",
  description:
    "Learn about VaighaWeaves shipping timelines, delivery charges, and order tracking.",
}

export default function ShippingPolicyPage() {
  return (
    <div className="content-container py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold mb-8">Shipping Policy</h1>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Processing Time</h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            Orders are processed within 1–2 business days after payment
            confirmation. You will receive an email notification with tracking
            details once your order is shipped.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Delivery Timelines</h2>
          <ul className="list-disc list-inside text-ui-fg-subtle space-y-2">
            <li>
              <strong>Standard Delivery:</strong> 5–7 business days across India
            </li>
            <li>
              <strong>Express Delivery:</strong> 2–3 business days (available
              for select pin codes, additional charges apply)
            </li>
            <li>
              <strong>International Shipping:</strong> 10–15 business days
              (customs duties payable by recipient)
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Shipping Charges</h2>
          <ul className="list-disc list-inside text-ui-fg-subtle space-y-2">
            <li>Free shipping on orders above ₹1,499</li>
            <li>₹99 flat shipping fee for orders below ₹1,499</li>
            <li>Express delivery charges calculated at checkout</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Order Tracking</h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            Once your order is dispatched, you will receive a tracking ID via
            email and SMS. You can track your shipment on our website or directly
            on the courier partner&apos;s portal.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">
            Non-Delivery &amp; Lost Packages
          </h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            If your package is not delivered within the estimated timeframe,
            please contact us at{" "}
            <a
              href="mailto:support@vaighaweaves.com"
              className="underline hover:text-ui-fg-base"
            >
              support@vaighaweaves.com
            </a>{" "}
            within 15 days of the expected delivery date. We will investigate and
            arrange a replacement or refund as appropriate.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            Damaged or Incorrect Items
          </h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            If you receive a damaged or incorrect item, please photograph the
            package and contents and email us within 48 hours of delivery. We
            will arrange a free replacement or full refund.
          </p>
        </section>
      </div>
    </div>
  )
}
