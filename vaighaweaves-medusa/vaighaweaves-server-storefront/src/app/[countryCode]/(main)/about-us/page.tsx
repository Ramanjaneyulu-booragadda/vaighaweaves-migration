import { Metadata } from "next"

export const metadata: Metadata = {
  title: "About Us — VaighaWeaves",
  description:
    "VaighaWeaves is dedicated to preserving and promoting authentic handloom sarees crafted by skilled Indian artisans.",
}

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "VaighaWeaves",
  url: "https://vaighaweaves.com",
  logo: "https://vaighaweaves.com/logo.png",
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+91-98765-43210",
    contactType: "customer service",
    availableLanguage: ["English", "Telugu", "Hindi"],
  },
  sameAs: [
    "https://www.instagram.com/vaighaweaves",
    "https://www.facebook.com/vaighaweaves",
  ],
}

export default function AboutUsPage() {
  return (
    <div className="content-container py-12">
      {/* JSON-LD Organization schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />

      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold mb-6 text-center">About Us</h1>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Our Story</h2>
          <p className="text-ui-fg-subtle leading-relaxed mb-4">
            VaighaWeaves was born from a deep passion for preserving India&apos;s
            rich handloom heritage. We work directly with master weavers across
            Telangana and Andhra Pradesh, bringing their exquisite handcrafted
            sarees to customers worldwide.
          </p>
          <p className="text-ui-fg-subtle leading-relaxed">
            Every saree in our collection is a labour of love — woven thread by
            thread on traditional looms, carrying centuries of artisanal
            expertise. By choosing VaighaWeaves, you are not just buying a
            saree; you are supporting a weaver&apos;s family and keeping an
            ancient craft alive.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Our Mission</h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            To bridge the gap between traditional handloom weavers and modern
            consumers, ensuring fair wages for artisans while delivering
            authentic, high-quality handloom sarees at accessible prices. We
            believe that sustainability and tradition go hand-in-hand.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Our Collections</h2>
          <ul className="list-disc list-inside text-ui-fg-subtle space-y-2">
            <li>
              <strong>Pochampally Ikat</strong> — Vibrant geometric patterns
              from the Ikat weaving tradition
            </li>
            <li>
              <strong>Kanjivaram Silk</strong> — Luxurious pure mulberry silk
              sarees with zari borders
            </li>
            <li>
              <strong>Banarasi Silk</strong> — Opulent sarees woven with fine
              silk and intricate brocade
            </li>
            <li>
              <strong>Gadwal</strong> — Lightweight silk-cotton blend sarees
              with contrast borders
            </li>
            <li>
              <strong>Narayanpet Cotton</strong> — Crisp cotton sarees perfect
              for everyday elegance
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">
            Our Commitment to Artisans
          </h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            We partner exclusively with weaver cooperatives and self-help groups
            that ensure fair compensation, safe working conditions, and no child
            labour. A portion of every sale goes back into the weaving
            communities to fund skills training and equipment upgrades.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Get in Touch</h2>
          <p className="text-ui-fg-subtle leading-relaxed">
            Have a question or want to learn more? We&apos;d love to hear from
            you. Visit our{" "}
            <a href="/contact" className="underline hover:text-ui-fg-base">
              Contact page
            </a>{" "}
            or email us at{" "}
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
