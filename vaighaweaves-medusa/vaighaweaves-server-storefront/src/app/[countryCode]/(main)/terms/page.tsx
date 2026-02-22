import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service — VaighaWeaves",
  description:
    "Read VaighaWeaves' terms of service governing the use of our website and purchase of our products.",
}

export default function TermsPage() {
  return (
    <div className="content-container py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold mb-2">Terms of Service</h1>
        <p className="text-ui-fg-subtle text-sm mb-8">
          Last updated: February 2026
        </p>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">
            1. Acceptance of Terms
          </h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            By accessing or using the VaighaWeaves website and placing orders,
            you agree to be bound by these Terms of Service and our Privacy
            Policy. If you do not agree, please do not use our services.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">2. Products</h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            All products are subject to availability. Colours and patterns may
            vary slightly from website images due to the handcrafted nature of
            our products and screen differences. We reserve the right to
            discontinue or modify products at any time.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">3. Pricing &amp; Payment</h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            All prices are listed in Indian Rupees (INR) and are inclusive of
            GST. We reserve the right to change prices at any time. Payment must
            be completed before an order is confirmed. We accept UPI, credit/
            debit cards, net banking, and Cash on Delivery (subject to
            eligibility).
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">4. Returns &amp; Refunds</h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            Returns are accepted within 7 days of delivery for items in original,
            unused condition with tags intact. Refunds are processed within 7–10
            business days. Customised or made-to-order items are not eligible for
            return unless defective.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">
            5. Intellectual Property
          </h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            All content on this website — including images, text, logos, and
            design — is the property of VaighaWeaves and protected by applicable
            intellectual property laws. Unauthorised reproduction or distribution
            is prohibited.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">
            6. Limitation of Liability
          </h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            VaighaWeaves shall not be liable for any indirect, incidental, or
            consequential damages arising from the use of our products or
            website. Our maximum liability is limited to the amount paid for the
            product in question.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Governing Law</h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            These Terms are governed by the laws of India. Any disputes shall be
            subject to the exclusive jurisdiction of courts in Hyderabad,
            Telangana. For any queries, contact{" "}
            <a
              href="mailto:support@vaighaweaves.com"
              className="underline hover:text-ui-fg-base"
            >
              support@vaighaweaves.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
