import Link from "next/link"

export default function Nav() {
  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold text-primary">
            VaighaWeaves
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/shop" className="text-sm text-gray-700 hover:text-primary">
              Shop
            </Link>
            <Link href="/categories/sarees" className="text-sm text-gray-700 hover:text-primary">
              Sarees
            </Link>
            <Link href="/categories/silk" className="text-sm text-gray-700 hover:text-primary">
              Silk
            </Link>
            <Link href="/categories/cotton" className="text-sm text-gray-700 hover:text-primary">
              Cotton
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/cart" className="text-sm text-gray-700 hover:text-primary">
              Cart
            </Link>
            <Link href="/account" className="text-sm text-gray-700 hover:text-primary">
              Account
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
