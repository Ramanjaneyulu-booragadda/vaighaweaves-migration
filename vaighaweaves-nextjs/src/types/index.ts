export type ProductType = "READYMADE" | "FABRIC" | "SAREE"

export type ProductMetadata = {
  productType?: ProductType
  fabric?: string
  occasion?: string
  brand?: string
  description?: string
  weaveType?: string
  zariType?: string
  blouseLength?: string
  careInstructions?: string
}

export type ProductSize = {
  size: string
  inventoryQuantity: number
  variantId: string
}

export type ProductWithMetadata = {
  id: string
  handle: string
  title: string
  subtitle?: string
  description?: string
  thumbnail?: string
  images?: Array<{ id: string; url: string }>
  variants?: Array<{
    id: string
    title: string
    calculated_price?: {
      calculated_amount: number
      currency_code: string
    }
    inventory_quantity?: number
    images: Array<{ id: string; url: string }>
    options?: Array<{ value: string }>
  }>
  categories?: Array<{
    id: string
    handle: string
    name: string
    parent_category?: { id: string; handle: string; name: string } | null
  }>
  tags?: Array<{ id: string; value: string }>
  metadata?: Record<string, unknown>
}

export type Category = {
  id: string
  handle: string
  name: string
  description?: string
  thumbnail?: string
  parent_category?: Category | null
  category_children?: Category[]
  products?: ProductWithMetadata[]
}

export type FilterParams = {
  category?: string
  fabric?: string
  occasion?: string
  priceMin?: string
  priceMax?: string
  sort?: string
  page?: string
}

export type PaginatedProducts = {
  products: ProductWithMetadata[]
  count: number
  page: number
  totalPages: number
}
