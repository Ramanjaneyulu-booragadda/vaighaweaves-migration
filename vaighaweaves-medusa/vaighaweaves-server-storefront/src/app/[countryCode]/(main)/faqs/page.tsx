import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Frequently Asked Questions — VaighaWeaves",
  description:
    "Find answers to frequently asked questions about VaighaWeaves handloom sarees, shipping, returns, and more.",
}

const faqs = [
  {
    question: "What makes VaighaWeaves sarees special?",
    answer:
      "VaighaWeaves sarees are handcrafted by skilled artisans using traditional techniques passed down through generations. Each saree is made with authentic handloom weaving, ensuring unique patterns and superior quality that machine-made fabrics cannot replicate.",
  },
  {
    question: "How do I care for my handloom saree?",
    answer:
      "Dry cleaning is recommended for silk sarees. Cotton handloom sarees can be gently hand-washed with mild detergent in cold water. Avoid wringing; instead, gently squeeze out excess water and dry in shade. Iron on reverse side at appropriate temperature.",
  },
  {
    question: "What is your return and exchange policy?",
    answer:
      "We accept returns within 7 days of delivery for unused, unwashed sarees in original packaging. Please raise a return request through your account or contact our support team. Exchanges are processed within 5–7 business days.",
  },
  {
    question: "How long does shipping take?",
    answer:
      "Standard delivery takes 5–7 business days across India. Express delivery (2–3 business days) is available for select pin codes. International shipping is available and typically takes 10–15 business days.",
  },
  {
    question: "Do you offer Cash on Delivery?",
    answer:
      "Yes, Cash on Delivery is available for orders up to ₹5,000 across most pin codes in India. For orders above this amount, we accept UPI, credit/debit cards, net banking, and wallets.",
  },
  {
    question: "Are the colours in photos accurate?",
    answer:
      "We make every effort to display colours as accurately as possible. However, colours may vary slightly due to monitor settings and lighting conditions. If you have any concerns, please contact us before placing your order.",
  },
  {
    question: "Do you offer bulk or wholesale pricing?",
    answer:
      "Yes! We offer attractive pricing for bulk orders. Please contact us at support@vaighaweaves.com with your requirements and we will get back to you with a custom quote.",
  },
  {
    question: "Can I track my order?",
    answer:
      "Absolutely. Once your order is shipped, you will receive a tracking link via email and SMS. You can also track your order by logging into your account on our website.",
  },
]

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
}

export default function FAQsPage() {
  return (
    <div className="content-container py-12 max-w-3xl mx-auto">
      {/* JSON-LD for FAQ rich snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <h1 className="text-3xl font-semibold mb-2 text-center">
        Frequently Asked Questions
      </h1>
      <p className="text-ui-fg-subtle text-center mb-10">
        Can&apos;t find an answer? Contact us at{" "}
        <a
          href="mailto:support@vaighaweaves.com"
          className="underline hover:text-ui-fg-base"
        >
          support@vaighaweaves.com
        </a>
      </p>

      <div className="flex flex-col divide-y divide-ui-border-base">
        {faqs.map((faq, index) => (
          <FAQItem key={index} question={faq.question} answer={faq.answer} />
        ))}
      </div>
    </div>
  )
}

function FAQItem({
  question,
  answer,
}: {
  question: string
  answer: string
}) {
  return (
    <details className="group py-5">
      <summary className="flex items-center justify-between cursor-pointer list-none gap-4">
        <span className="font-medium text-ui-fg-base">{question}</span>
        <span
          className="text-ui-fg-subtle flex-shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        >
          ▾
        </span>
      </summary>
      <p className="mt-3 text-ui-fg-subtle text-sm leading-relaxed">{answer}</p>
    </details>
  )
}
