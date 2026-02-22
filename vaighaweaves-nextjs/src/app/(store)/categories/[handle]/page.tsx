import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCategoryByHandle, getCategories, getProducts } from "@lib/data/products"
import ProductGrid from "@modules/products/components/product-grid"
import Pagination from "@modules/common/components/pagination"
import { Suspense } from "react"
import Link from "next/link"

export const revalidate = 3600

type CategoryPageProps = {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ page?: string; sort?: string }>
}

export async function generateStaticParams() {
  try {
    const categories = await getCategories()
    return categories
      .filter((c) => !!c.handle)
      .map((c) => ({ handle: c.handle }))
  } catch (error) {
    console.error("Failed to generate static params for category pages:", error)
    return []
  }
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { handle } = await params
  try {
    const category = await getCategoryByHandle(handle)
    if (!category) return { title: "Category — VaighaWeaves" }
    return {
      title: `${category.name} — VaighaWeaves`,
      description:
        category.description ??
        `Shop ${category.name} — authentic handloom sarees at VaighaWeaves.`,
      openGraph: {
        title: `${category.name} — VaighaWeaves`,
        description: `Shop ${category.name} — authentic handloom sarees.`,
      },
      alternates: {
        canonical: `/categories/${handle}`,
      },
    }
  } catch {
    return { title: "Category — VaighaWeaves" }
  }
}

const PAGE_SIZE = 12

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { handle } = await params
  const { page, sort } = await searchParams

  const category = await getCategoryByHandle(handle)
  if (!category) notFound()

  const result = await getProducts({
    category: handle,
    sort,
    page: page ?? "1",
    limit: PAGE_SIZE,
  }).catch(() => ({ products: [], count: 0, page: 1, totalPages: 0 }))

  // JSON-LD BreadcrumbList
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://vaighaweaves.com",
      },
      ...(category.parent_category
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: category.parent_category.name,
              item: `https://vaighaweaves.com/categories/${category.parent_category.handle}`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: category.name,
              item: `https://vaighaweaves.com/categories/${category.handle}`,
            },
          ]
        : [
            {
              "@type": "ListItem",
              position: 2,
              name: category.name,
              item: `https://vaighaweaves.com/categories/${category.handle}`,
            },
          ]),
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          {category.parent_category && (
            <>
              <span>/</span>
              <Link
                href={`/categories/${category.parent_category.handle}`}
                className="hover:text-primary"
              >
                {category.parent_category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-gray-900 font-medium">{category.name}</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
          {category.description && (
            <p className="mt-2 text-gray-600">{category.description}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            {result.count} products
          </p>
        </div>

        {/* Subcategory chips */}
        {category.category_children && category.category_children.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {category.category_children.map((sub) => (
              <Link
                key={sub.id}
                href={`/categories/${sub.handle}`}
                className="px-4 py-1.5 rounded-full border border-gray-300 text-sm text-gray-700 hover:border-primary hover:text-primary transition-colors"
              >
                {sub.name}
              </Link>
            ))}
          </div>
        )}

        <ProductGrid products={result.products} />
        <Suspense>
          <Pagination total={result.count} pageSize={PAGE_SIZE} />
        </Suspense>
      </div>
    </>
  )
}
