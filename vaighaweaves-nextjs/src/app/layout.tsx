import type { Metadata } from "next"
import { WishlistProvider } from "@context/WishlistContext"
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
        <WishlistProvider>
          <main className="relative">{children}</main>
        </WishlistProvider>
      </body>
    </html>
  )
}
