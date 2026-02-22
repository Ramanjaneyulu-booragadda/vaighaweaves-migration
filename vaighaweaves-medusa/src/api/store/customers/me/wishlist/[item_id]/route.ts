import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WISHLIST_MODULE } from "../../../../../modules/wishlist"
import WishlistModuleService from "../../../../../modules/wishlist/service"

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const { item_id } = req.params

  const wishlistService: WishlistModuleService = req.scope.resolve(WISHLIST_MODULE)

  try {
    await wishlistService.removeItem(item_id, customerId)
    res.status(200).json({ id: item_id, deleted: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    res.status(404).json({ message })
  }
}
