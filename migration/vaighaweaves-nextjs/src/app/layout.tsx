import type { Metadata } from "next"
import { WishlistProvider } from "@context/WishlistContext"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "VaighaWeaves",
    template: "%s | VaighaWeaves",
  },
  description: "Premium handloom sarees and Indian ethnic wear",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <WishlistProvider>{children}</WishlistProvider>
      </body>
    </html>
  )
}
