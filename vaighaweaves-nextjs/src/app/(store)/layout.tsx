import Nav from "@modules/layout/components/nav"
import Footer from "@modules/layout/components/footer"

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Nav />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  )
}
