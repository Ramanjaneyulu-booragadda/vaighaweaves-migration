"use client"

import { useState } from "react"

interface ProfileFormProps {
  customer: any
}

/**
 * ProfileForm — Client Component for editing customer profile.
 * TODO: wire form submission to a Medusa update-customer Server Action.
 */
export default function ProfileForm({ customer }: ProfileFormProps) {
  const [firstName, setFirstName] = useState(customer?.first_name ?? "")
  const [lastName, setLastName] = useState(customer?.last_name ?? "")
  const [phone, setPhone] = useState(customer?.phone ?? "")
  const [emailOptIn, setEmailOptIn] = useState(
    customer?.metadata?.email_opt_in ?? false
  )
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)
    try {
      // TODO: call update customer server action
      // await updateCustomer({ first_name: firstName, last_name: lastName, phone })
      await new Promise((r) => setTimeout(r, 600)) // placeholder
      setMessage("Profile updated successfully.")
    } catch (err: any) {
      setMessage(err.message ?? "Failed to update profile.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="first_name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            First name
          </label>
          <input
            id="first_name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor="last_name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Last name
          </label>
          <input
            id="last_name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={customer?.email ?? ""}
          disabled
          className="w-full border border-gray-200 bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-400">
          Contact support to change your email address.
        </p>
      </div>

      <div>
        <label
          htmlFor="phone"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Phone number
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 9876543210"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="flex items-center gap-x-3">
        <input
          id="email_opt_in"
          type="checkbox"
          checked={emailOptIn}
          onChange={(e) => setEmailOptIn(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        <label htmlFor="email_opt_in" className="text-sm text-gray-700">
          Receive promotional emails and offers
        </label>
      </div>

      {message && (
        <p
          className={`text-sm ${
            message.includes("success") ? "text-green-600" : "text-red-500"
          }`}
          role="status"
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="self-start px-6 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-md font-medium text-sm transition-colors"
      >
        {isSaving ? "Saving…" : "Save Changes"}
      </button>
    </form>
  )
}
