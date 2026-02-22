import type { Metadata } from "next"
import { Suspense } from "react"
import { getProducts } from "@lib/data/products"
import FilterSidebar from "@modules/store/components/filter-sidebar"
import ProductGrid from "@modules/products/components/product-grid"
import Pagination from "@modules/common/components/pagination"

type ShopPageProps = {
  searchParams: Promise<{
    category?: string
    fabric?: string
    occasion?: string
    priceMin?: string
    priceMax?: string
    sort?: string
    page?: string
  }>
}

export async function generateMetadata({
  searchParams,
}: ShopPageProps): Promise<Metadata> {
  const params = await searchParams
  const category = params.category ?? "All Sarees"
  return {
    title: `${category} — VaighaWeaves`,
    description: `Shop ${category} — authentic handloom sarees directly from master weavers.`,
    openGraph: {
      title: `${category} — VaighaWeaves`,
      description: `Shop ${category} — authentic handloom sarees.`,
    },
  }
}

const PAGE_SIZE = 12

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams

  const result = await getProducts({
    category: params.category,
    fabric: params.fabric,
    occasion: params.occasion,
    priceMin: params.priceMin,
    priceMax: params.priceMax,
    sort: params.sort,
    page: params.page ?? "1",
    limit: PAGE_SIZE,
  }).catch(() => ({ products: [], count: 0, page: 1, totalPages: 0 }))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        {params.category ?? "All Sarees"}
        <span className="text-base font-normal text-gray-500 ml-2">
          ({result.count} products)
        </span>
      </h1>
      <div className="flex flex-col md:flex-row gap-8">
        <Suspense>
          <FilterSidebar />
        </Suspense>
        <div className="flex-1">
          <ProductGrid products={result.products} />
          <Suspense>
            <Pagination total={result.count} pageSize={PAGE_SIZE} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
