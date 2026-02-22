import "server-only"
import { sdk } from "@lib/config"
import { getAuthHeaders } from "@lib/session"

/**
 * List available shipping methods for the given cart.
 */
export async function listCartShippingMethods(cartId: string) {
  const headers = await getAuthHeaders()

  return sdk.client
    .fetch<{ shipping_options: any[] }>(
      `/store/shipping-options?cart_id=${cartId}`,
      {
        method: "GET",
        headers,
        next: { tags: ["shipping"] },
        cache: "force-cache",
      }
    )
    .then(({ shipping_options }) => shipping_options ?? [])
    .catch(() => [])
}

/**
 * List available payment methods for the given region.
 */
export async function listCartPaymentMethods(regionId: string) {
  const headers = await getAuthHeaders()

  return sdk.client
    .fetch<{ payment_providers: any[] }>(
      `/store/payment-providers?region_id=${regionId}`,
      {
        method: "GET",
        headers,
        next: { tags: ["payment-providers"] },
        cache: "force-cache",
      }
    )
    .then(({ payment_providers }) => payment_providers ?? [])
    .catch(() => [])
}
