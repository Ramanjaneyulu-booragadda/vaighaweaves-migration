import "server-only"
import { sdk } from "@lib/config"
import { getAuthHeaders } from "@lib/session"

/**
 * Retrieve a single order by ID.
 */
export async function retrieveOrder(id: string) {
  const headers = await getAuthHeaders()

  return sdk.client
    .fetch<{ order: any }>(`/store/orders/${id}`, {
      method: "GET",
      query: {
        fields:
          "*payment_collections.payments,*items,*items.metadata,*items.variant,*items.product",
      },
      headers,
      next: { tags: ["orders"] },
      cache: "force-cache",
    })
    .then(({ order }) => order)
    .catch(() => null)
}

/**
 * List orders for the authenticated customer.
 */
export async function listOrders(limit = 10, offset = 0) {
  const headers = await getAuthHeaders()
  if (!headers.Authorization) return []

  return sdk.client
    .fetch<{ orders: any[]; count: number }>("/store/orders", {
      method: "GET",
      query: { limit, offset, fields: "*items,*items.variant,*items.product" },
      headers,
      next: { tags: ["orders"] },
      cache: "force-cache",
    })
    .then(({ orders }) => orders)
    .catch(() => [])
}

/**
 * Retrieve the customer's wishlist items.
 * Requires Stream A's wishlist module to be merged.
 */
export async function getWishlist() {
  const headers = await getAuthHeaders()
  if (!headers.Authorization) return []

  return sdk.client
    .fetch<{ wishlist: any[] }>("/store/customers/me/wishlist", {
      method: "GET",
      headers,
      next: { tags: ["wishlist"] },
      cache: "force-cache",
    })
    .then(({ wishlist }) => wishlist ?? [])
    .catch(() => [])
}
