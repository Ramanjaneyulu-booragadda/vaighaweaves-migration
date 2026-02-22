import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Maintenance — VaighaWeaves",
  description: "We are currently performing scheduled maintenance. Please check back soon.",
}

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ui-bg-base px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">🔧</div>
        <h1 className="text-3xl font-semibold mb-4 text-ui-fg-base">
          Under Maintenance
        </h1>
        <p className="text-ui-fg-subtle mb-6 leading-relaxed">
          We&apos;re currently performing scheduled maintenance to improve your
          shopping experience. We&apos;ll be back shortly!
        </p>
        <p className="text-ui-fg-muted text-sm">
          For urgent queries, email us at{" "}
          <a
            href="mailto:support@vaighaweaves.com"
            className="underline hover:text-ui-fg-base"
          >
            support@vaighaweaves.com
          </a>
        </p>
      </div>
    </div>
  )
}
