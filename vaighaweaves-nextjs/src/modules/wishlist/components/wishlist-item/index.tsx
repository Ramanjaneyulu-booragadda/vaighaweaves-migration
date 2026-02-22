"use client"

import { formatINR } from "@lib/util/money"

export interface WishlistItemType {
  id: string
  product_id?: string
  variant_id?: string
  product_title?: string
  thumbnail?: string
  price?: number
  currency_code?: string
}

interface WishlistItemProps {
  item: WishlistItemType
}

/**
 * WishlistItem — displays a single wishlist entry with "Add to Cart" and
 * "Remove" actions.
 *
 * Ported from vaighaweaves-ui/src/pages/Wishlist.tsx.
 */
export default function WishlistItem({ item }: WishlistItemProps) {
  const handleAddToCart = () => {
    // TODO: call addToCart server action (Stream A dependency)
    console.log("Add to cart:", item.variant_id ?? item.product_id)
  }

  const handleRemove = () => {
    // TODO: call removeFromWishlist server action (Stream A dependency)
    console.log("Remove from wishlist:", item.id)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden flex flex-col">
      {item.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnail}
          alt={item.product_title ?? "Product"}
          className="w-full h-48 object-cover"
        />
      ) : (
        <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
          No image
        </div>
      )}

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-medium text-gray-900 truncate mb-1">
          {item.product_title ?? "Product"}
        </h3>

        {item.price != null && (
          <p className="text-sm font-semibold text-brand-600 mb-4">
            {formatINR(item.price)}
          </p>
        )}

        <div className="mt-auto flex gap-x-2">
          <button
            type="button"
            onClick={handleAddToCart}
            className="flex-1 py-2 text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-md transition-colors"
          >
            Add to Cart
          </button>
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove from wishlist"
            className="p-2 text-gray-400 hover:text-red-500 border border-gray-200 rounded-md transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
