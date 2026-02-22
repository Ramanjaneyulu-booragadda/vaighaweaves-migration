"use client"

import { useState } from "react"
import { submitContactForm } from "@modules/contact/actions"

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    await submitContactForm(formData)
    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 p-6 text-center">
        <p className="text-green-800 font-medium text-lg">
          ✅ Message sent successfully!
        </p>
        <p className="text-green-700 text-sm mt-1">
          We&apos;ll get back to you within 24 hours.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-ui-fg-base mb-1"
        >
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Your full name"
          className="w-full rounded-md border border-ui-border-base px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ui-fg-base"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-ui-fg-base mb-1"
        >
          Email <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="w-full rounded-md border border-ui-border-base px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ui-fg-base"
        />
      </div>

      <div>
        <label
          htmlFor="subject"
          className="block text-sm font-medium text-ui-fg-base mb-1"
        >
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          placeholder="What is this about?"
          className="w-full rounded-md border border-ui-border-base px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ui-fg-base"
        />
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium text-ui-fg-base mb-1"
        >
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder="Tell us how we can help..."
          className="w-full rounded-md border border-ui-border-base px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ui-fg-base resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-ui-fg-base text-ui-bg-base px-6 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send Message"}
      </button>
    </form>
  )
}
