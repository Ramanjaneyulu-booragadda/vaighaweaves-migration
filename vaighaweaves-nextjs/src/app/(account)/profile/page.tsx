import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getServerCustomer } from "@lib/session"
import ProfileForm from "./profile-form"

export const metadata: Metadata = {
  title: "Profile — VaighaWeaves",
  description: "View and update your profile information",
}

/**
 * Profile page — Server Component that loads current profile data,
 * then hands off to the client ProfileForm for editing.
 */
export default async function ProfilePage() {
  const customer = await getServerCustomer()

  if (!customer) {
    return notFound()
  }

  return (
    <div className="py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile</h1>
        <p className="text-sm text-gray-500 mb-8">
          View and update your name, email, and phone number.
        </p>
        <ProfileForm customer={customer} />
      </div>
    </div>
  )
}
