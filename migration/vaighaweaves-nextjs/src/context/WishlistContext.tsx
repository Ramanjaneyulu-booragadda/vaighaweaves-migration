"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

export interface WishlistItem {
  id: string
  product_id: string
  variant_id?: string
  product_title: string
  thumbnail?: string
  price?: number
}

interface WishlistContextValue {
  items: WishlistItem[]
  addItem: (item: WishlistItem) => void
  removeItem: (id: string) => void
  isInWishlist: (productId: string, variantId?: string) => boolean
  clearWishlist: () => void
}

const WishlistContext = createContext<WishlistContextValue>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  isInWishlist: () => false,
  clearWishlist: () => {},
})

const STORAGE_KEY = "vw_wishlist"

/**
 * WishlistProvider — manages the wishlist in memory, persisted to
 * localStorage for guest users.
 *
 * For authenticated users this acts as the local cache; on login the caller
 * should merge localStorage items with the server wishlist (via Stream A API)
 * and then call clearWishlist() to clean up the local copy.
 *
 * Ported from vaighaweaves-ui/src/context/CartWishlistContext.tsx (wishlist half).
 */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage on mount (client only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setItems(JSON.parse(stored) as WishlistItem[])
      }
    } catch {
      // localStorage unavailable or parse error — start empty
    }
    setHydrated(true)
  }, [])

  // Persist to localStorage whenever items change (after hydration)
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Storage might be full or blocked — silently fail
    }
  }, [items, hydrated])

  const addItem = useCallback((item: WishlistItem) => {
    setItems((prev) => {
      const exists = prev.some(
        (i) =>
          i.product_id === item.product_id &&
          i.variant_id === item.variant_id
      )
      if (exists) return prev
      return [...prev, item]
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const isInWishlist = useCallback(
    (productId: string, variantId?: string) => {
      return items.some(
        (i) =>
          i.product_id === productId &&
          (variantId ? i.variant_id === variantId : true)
      )
    },
    [items]
  )

  const clearWishlist = useCallback(() => {
    setItems([])
  }, [])

  const value = useMemo<WishlistContextValue>(
    () => ({ items, addItem, removeItem, isInWishlist, clearWishlist }),
    [items, addItem, removeItem, isInWishlist, clearWishlist]
  )

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  return useContext(WishlistContext)
}
