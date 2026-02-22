import "server-only"
import { sdk, DEFAULT_REGION_ID } from "@lib/config"
import type {
  Category,
  FilterParams,
  PaginatedProducts,
  ProductMetadata,
  ProductSize,
  ProductWithMetadata,
} from "@/types"

const PRODUCTS_LIMIT = 12

/**
 * Fetch a single product by handle from Medusa store API.
 */
export async function getProduct(handle: string): Promise<ProductWithMetadata> {
  const { products } = await sdk.client.fetch<{
    products: ProductWithMetadata[]
  }>("/store/products", {
    query: {
      handle,
      region_id: DEFAULT_REGION_ID,
      fields:
        "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags,*categories",
      limit: 1,
    },
    next: { revalidate: 60, tags: ["products"] },
  })

  if (!products[0]) {
    throw new Error(`Product not found: ${handle}`)
  }

  return products[0]
}

/**
 * Fetch paginated products with optional filters.
 */
export async function getProducts(
  filters: FilterParams & { limit?: number }
): Promise<PaginatedProducts> {
  const limit = filters.limit ?? PRODUCTS_LIMIT
  const page = parseInt(filters.page ?? "1", 10)
  const offset = (page - 1) * limit

  const query: Record<string, unknown> = {
    region_id: DEFAULT_REGION_ID,
    fields:
      "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags,*categories",
    limit,
    offset,
  }

  if (filters.category) {
    query["category_handle[]"] = filters.category
  }
  if (filters.sort) {
    query["order"] = filters.sort
  }

  const { products, count } = await sdk.client.fetch<{
    products: ProductWithMetadata[]
    count: number
  }>("/store/products", {
    query,
    next: { revalidate: 60, tags: ["products"] },
  })

  const filteredProducts = filterByMetadata(products, filters)
  const totalPages = Math.ceil(count / limit)

  return { products: filteredProducts, count, page, totalPages }
}

/**
 * Client-side metadata filter for fabric/occasion (Medusa doesn't support these natively).
 */
function filterByMetadata(
  products: ProductWithMetadata[],
  filters: FilterParams
): ProductWithMetadata[] {
  return products.filter((p) => {
    const meta = p.metadata as Record<string, string> | undefined
    if (filters.fabric && meta?.fabric !== filters.fabric) return false
    if (filters.occasion && meta?.occasion !== filters.occasion) return false
    if (filters.priceMin || filters.priceMax) {
      const price = p.variants?.[0]?.calculated_price?.calculated_amount ?? 0
      if (filters.priceMin && price < parseFloat(filters.priceMin)) return false
      if (filters.priceMax && price > parseFloat(filters.priceMax)) return false
    }
    return true
  })
}

/**
 * Fetch featured products (products tagged with "featured").
 */
export async function getFeaturedProducts(
  limit = 6
): Promise<ProductWithMetadata[]> {
  const { products } = await sdk.client.fetch<{
    products: ProductWithMetadata[]
  }>("/store/products", {
    query: {
      region_id: DEFAULT_REGION_ID,
      "tags[]": "featured",
      fields: "*variants.calculated_price,*variants.images,+tags",
      limit,
    },
    next: { revalidate: 3600, tags: ["products", "featured"] },
  })
  return products
}

/**
 * Fetch deal products (products tagged with "deal").
 */
export async function getDeals(limit = 4): Promise<ProductWithMetadata[]> {
  const { products } = await sdk.client.fetch<{
    products: ProductWithMetadata[]
  }>("/store/products", {
    query: {
      region_id: DEFAULT_REGION_ID,
      "tags[]": "deal",
      fields: "*variants.calculated_price,*variants.images,+tags",
      limit,
    },
    next: { revalidate: 3600, tags: ["products", "deals"] },
  })
  return products
}

/**
 * Fetch trending products (products tagged with "trending").
 */
export async function getTrending(limit = 4): Promise<ProductWithMetadata[]> {
  const { products } = await sdk.client.fetch<{
    products: ProductWithMetadata[]
  }>("/store/products", {
    query: {
      region_id: DEFAULT_REGION_ID,
      "tags[]": "trending",
      fields: "*variants.calculated_price,*variants.images,+tags",
      limit,
    },
    next: { revalidate: 3600, tags: ["products", "trending"] },
  })
  return products
}

/**
 * Fetch product metadata from custom endpoint.
 */
export async function getProductMetadata(
  productId: string
): Promise<ProductMetadata | null> {
  try {
    const data = await sdk.client.fetch<{ metadata: ProductMetadata }>(
      `/store/products/${productId}/metadata`,
      {
        next: { revalidate: 60, tags: [`product-metadata-${productId}`] },
      }
    )
    return data.metadata ?? null
  } catch {
    return null
  }
}

/**
 * Fetch available sizes for a READYMADE product.
 */
export async function getProductSizes(
  productId: string
): Promise<ProductSize[]> {
  try {
    const data = await sdk.client.fetch<{ sizes: ProductSize[] }>(
      `/store/products/${productId}/sizes`,
      {
        next: { revalidate: 60, tags: [`product-sizes-${productId}`] },
      }
    )
    return data.sizes ?? []
  } catch {
    return []
  }
}

/**
 * Get all categories.
 */
export async function getCategories(): Promise<Category[]> {
  const { product_categories } = await sdk.client.fetch<{
    product_categories: Category[]
  }>("/store/product-categories", {
    query: {
      fields: "*category_children,*parent_category",
      limit: 100,
    },
    next: { revalidate: 3600, tags: ["categories"] },
  })
  return product_categories
}

/**
 * Get a single category by handle.
 */
export async function getCategoryByHandle(
  handle: string
): Promise<Category | null> {
  const { product_categories } = await sdk.client.fetch<{
    product_categories: Category[]
  }>("/store/product-categories", {
    query: {
      handle,
      fields: "*category_children,*products,*parent_category",
    },
    next: { revalidate: 3600, tags: [`category-${handle}`] },
  })
  return product_categories[0] ?? null
}
