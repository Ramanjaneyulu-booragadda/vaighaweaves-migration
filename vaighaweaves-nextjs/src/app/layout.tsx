import type { Metadata } from "next"
import "styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://vaighaweaves.com"
  ),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-mode="light">
      <body>
        <main className="relative">{children}</main>
      </body>
    </html>
  )
}
