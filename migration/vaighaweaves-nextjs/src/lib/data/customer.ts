import "server-only"
import { sdk } from "@lib/config"
import { getAuthHeaders } from "@lib/session"

/**
 * Retrieve the currently authenticated customer.
 */
export async function retrieveCustomer() {
  const headers = await getAuthHeaders()
  if (!headers.Authorization) return null

  return sdk.client
    .fetch<{ customer: any }>("/store/customers/me", {
      method: "GET",
      query: { fields: "*orders,*addresses" },
      headers,
      next: { tags: ["customer"] },
      cache: "force-cache",
    })
    .then(({ customer }) => customer)
    .catch(() => null)
}
