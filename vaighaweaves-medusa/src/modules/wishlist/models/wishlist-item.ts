import { model } from "@medusajs/framework/utils"

const WishlistItem = model.define("wishlist_item", {
  id: model.id(),
  customer_id: model.text(),
  product_id: model.text(),
  variant_id: model.text().nullable(),
})

export default WishlistItem
