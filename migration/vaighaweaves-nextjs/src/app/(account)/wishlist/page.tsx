import { Metadata } from "next"
import { getSession } from "@lib/session"
import { getWishlist } from "@lib/data/orders"
import WishlistItem from "@modules/wishlist/components/wishlist-item"
import WishlistEmptyState from "@modules/wishlist/components/empty-state"

export const metadata: Metadata = {
  title: "Wishlist — VaighaWeaves",
  description: "Your saved items",
}

/**
 * Wishlist page — Server Component.
 * Authenticated users: loads wishlist from Medusa API (Stream A module).
 * Guest users: empty list (localStorage wishlist handled by WishlistContext on client).
 */
export default async function WishlistPage() {
  const session = await getSession()
  // Stream A's wishlist module provides GET /store/customers/me/wishlist
  const wishlistItems = session ? await getWishlist() : []

  return (
    <div className="py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">My Wishlist</h1>

        {wishlistItems.length > 0 ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {wishlistItems.map((item: any) => (
              <li key={item.id}>
                <WishlistItem item={item} />
              </li>
            ))}
          </ul>
        ) : (
          <WishlistEmptyState />
        )}
      </div>
    </div>
  )
}
