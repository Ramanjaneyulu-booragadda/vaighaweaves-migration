import { Metadata } from "next"
import ContactInfo from "@modules/contact/components/contact-info"
import ContactForm from "@modules/contact/components/contact-form"

export const metadata: Metadata = {
  title: "Contact Us — VaighaWeaves",
  description:
    "Get in touch with VaighaWeaves. We are happy to help with your queries about our handloom sarees.",
}

export default function ContactPage() {
  return (
    <div className="content-container py-12">
      <h1 className="text-3xl font-semibold mb-10 text-center">Contact Us</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
        <ContactInfo />
        <ContactForm />
      </div>
    </div>
  )
}
