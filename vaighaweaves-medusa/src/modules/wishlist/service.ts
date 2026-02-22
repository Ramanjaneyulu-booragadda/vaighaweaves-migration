import { MedusaService } from "@medusajs/framework/utils"
import WishlistItem from "./models/wishlist-item"

type WishlistItemDTO = {
  id: string
  customer_id: string
  product_id: string
  variant_id: string | null
  created_at: Date
}

class WishlistModuleService extends MedusaService({
  WishlistItem,
}) {
  async addItem(
    customerId: string,
    productId: string,
    variantId?: string
  ): Promise<WishlistItemDTO> {
    const [item] = await this.createWishlistItems([
      {
        customer_id: customerId,
        product_id: productId,
        variant_id: variantId ?? null,
      },
    ])
    return item as WishlistItemDTO
  }

  async removeItem(itemId: string, customerId: string): Promise<void> {
    const [item] = await this.listWishlistItems({ id: itemId })
    if (!item) {
      throw new Error(`Wishlist item ${itemId} not found`)
    }
    if (item.customer_id !== customerId) {
      throw new Error(
        `Wishlist item ${itemId} does not belong to customer ${customerId}`
      )
    }
    await this.deleteWishlistItems(itemId)
  }

  async getByCustomer(customerId: string): Promise<WishlistItemDTO[]> {
    return (await this.listWishlistItems({
      customer_id: customerId,
    })) as WishlistItemDTO[]
  }

  async clearAll(customerId: string): Promise<void> {
    const items = await this.listWishlistItems({ customer_id: customerId })
    if (items.length > 0) {
      await this.deleteWishlistItems(items.map((i) => i.id))
    }
  }

  async isInWishlist(
    customerId: string,
    productId: string,
    variantId?: string
  ): Promise<boolean> {
    const filters: Record<string, string> = {
      customer_id: customerId,
      product_id: productId,
    }
    if (variantId) {
      filters.variant_id = variantId
    }
    const items = await this.listWishlistItems(filters)
    return items.length > 0
  }
}

export default WishlistModuleService
