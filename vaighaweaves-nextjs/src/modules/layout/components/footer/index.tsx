import Link from "next/link"

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-12 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">VaighaWeaves</h3>
            <p className="text-gray-400 text-sm">
              Premium handloom sarees directly from master weavers.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-4">
              Shop
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/shop" className="text-gray-400 hover:text-white text-sm">
                  All Products
                </Link>
              </li>
              <li>
                <Link href="/categories/silk-sarees" className="text-gray-400 hover:text-white text-sm">
                  Silk Sarees
                </Link>
              </li>
              <li>
                <Link href="/categories/cotton-sarees" className="text-gray-400 hover:text-white text-sm">
                  Cotton Sarees
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-4">
              Help
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-gray-400 hover:text-white text-sm">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-white text-sm">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} VaighaWeaves. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
