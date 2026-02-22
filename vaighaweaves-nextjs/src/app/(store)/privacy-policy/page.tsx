import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy — VaighaWeaves",
  description:
    "Read VaighaWeaves' privacy policy to understand how we collect, use, and protect your personal information.",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="content-container py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold mb-2">Privacy Policy</h1>
        <p className="text-ui-fg-subtle text-sm mb-8">
          Last updated: February 2026
        </p>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">
            1. Information We Collect
          </h2>
          <p className="text-ui-fg-subtle leading-relaxed mb-3">
            We collect information you provide directly to us, including:
          </p>
          <ul className="list-disc list-inside text-ui-fg-subtle space-y-1">
            <li>Name, email address, phone number, and shipping address</li>
            <li>Payment information (processed securely via Razorpay)</li>
            <li>Order history and browsing behaviour on our platform</li>
            <li>
              Communications you send us (support requests, contact forms)
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">
            2. How We Use Your Information
          </h2>
          <ul className="list-disc list-inside text-ui-fg-subtle space-y-1">
            <li>To process and fulfil your orders</li>
            <li>To send order confirmations, shipping updates, and invoices</li>
            <li>To respond to your enquiries and provide customer support</li>
            <li>
              To send promotional communications (with your consent, opt-out
              available at any time)
            </li>
            <li>To improve our website and services</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">
            3. Sharing of Information
          </h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            We do not sell or rent your personal data to third parties. We may
            share information with trusted service providers (courier partners,
            payment processors) strictly for the purpose of fulfilling your
            order. All partners are contractually bound to keep your data
            confidential.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">4. Cookies</h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            We use cookies to enhance your browsing experience, remember your
            cart, and analyse site traffic. You can disable cookies in your
            browser settings; however, some features may not function correctly.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">5. Data Security</h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            We implement industry-standard security measures including SSL
            encryption, secure payment processing via Razorpay, and regular
            security audits to protect your personal information.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">6. Your Rights</h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            You have the right to access, correct, or delete your personal data.
            To exercise these rights, please contact us at{" "}
            <a
              href="mailto:support@vaighaweaves.com"
              className="underline hover:text-ui-fg-base"
            >
              support@vaighaweaves.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            7. Changes to This Policy
          </h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            We may update this Privacy Policy from time to time. Changes will
            be posted on this page with an updated date. Continued use of our
            website after changes constitutes acceptance of the revised policy.
          </p>
        </section>
      </div>
    </div>
  )
}
