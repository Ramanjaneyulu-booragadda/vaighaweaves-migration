import "server-only"
import { sdk } from "@lib/config"
import { getAuthHeaders, getCartId } from "@lib/session"

/**
 * Retrieve the active cart using the cart_id cookie.
 */
export async function retrieveCart(cartId?: string) {
  const id = cartId ?? (await getCartId())
  if (!id) return null

  const headers = await getAuthHeaders()

  return sdk.client
    .fetch<{ cart: any }>(`/store/carts/${id}`, {
      method: "GET",
      query: {
        fields:
          "*items,*region,*items.product,*items.variant,*items.thumbnail,+items.total,*promotions,+shipping_methods.name",
      },
      headers,
      next: { tags: ["cart"] },
      cache: "force-cache",
    })
    .then(({ cart }) => cart)
    .catch(() => null)
}

/**
 * Initiate a payment session for the given provider.
 */
export async function initiatePaymentSession(
  cart: any,
  data: { provider_id: string }
) {
  const headers = await getAuthHeaders()

  return sdk.store.payment
    .initiatePaymentSession(cart, data, {}, headers)
    .catch((err) => {
      throw err
    })
}
