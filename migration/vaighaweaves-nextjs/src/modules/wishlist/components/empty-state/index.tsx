import Link from "next/link"

/**
 * WishlistEmptyState — shown when the wishlist has no items.
 */
export default function WishlistEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-y-4 text-center">
      <span className="text-5xl">🤍</span>
      <h2 className="text-xl font-semibold text-gray-700">
        Your wishlist is empty
      </h2>
      <p className="text-gray-500 text-sm max-w-xs">
        Save items you love and come back to them later.
      </p>
      <Link
        href="/shop"
        className="mt-4 px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md font-medium transition-colors text-sm"
      >
        Browse Products
      </Link>
    </div>
  )
}
