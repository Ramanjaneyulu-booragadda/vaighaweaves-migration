import Nav from "@modules/layout/templates/nav"
import Footer from "@modules/layout/templates/footer"

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Nav />
      <main>{children}</main>
      <Footer />
    </>
  )
}
