import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "VaighaWeaves — Premium Handloom Sarees",
    template: "%s — VaighaWeaves",
  },
  description:
    "Shop authentic handloom sarees, silk sarees, and traditional Indian weaves directly from master weavers.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://vaighaweaves.com"
  ),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
