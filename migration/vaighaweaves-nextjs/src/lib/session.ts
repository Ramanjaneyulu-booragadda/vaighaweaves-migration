import "server-only"
import { cookies } from "next/headers"
import { sdk } from "@lib/config"

// ─── Cookie helpers ──────────────────────────────────────────────────────────

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get("_medusa_jwt")?.value
}

export async function getCartId(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get("cart_id")?.value
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ─── Customer helpers ────────────────────────────────────────────────────────

/**
 * Retrieves the currently authenticated customer from Medusa.
 * Returns null when no auth token is present.
 */
export async function getServerCustomer() {
  const headers = await getAuthHeaders()
  if (!headers.Authorization) return null

  return sdk.client
    .fetch<{ customer: any }>("/store/customers/me", {
      method: "GET",
      headers,
      next: { tags: ["customer"] },
      cache: "force-cache",
    })
    .then(({ customer }) => customer)
    .catch(() => null)
}

/**
 * Returns a lightweight session object: just { customerId } or null.
 */
export async function getSession(): Promise<{ customerId: string } | null> {
  const customer = await getServerCustomer()
  return customer ? { customerId: customer.id } : null
}
