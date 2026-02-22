import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  getProduct,
  getProducts,
  getProductMetadata,
  getProductSizes,
} from "@lib/data/products"
import ProductTemplate from "@modules/products/templates"

export const revalidate = 60

type ProductDetailPageProps = {
  params: Promise<{ handle: string }>
}

export async function generateStaticParams() {
  try {
    const { products } = await getProducts({ limit: 500 })
    return products
      .filter((p) => !!p.handle)
      .map((p) => ({ handle: p.handle }))
  } catch (error) {
    console.error("Failed to generate static params for product pages:", error)
    return []
  }
}

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { handle } = await params
  try {
    const product = await getProduct(handle)
    const metadata = await getProductMetadata(product.id)
    return {
      title: `${product.title} — VaighaWeaves`,
      description:
        metadata?.description ??
        product.subtitle ??
        `${product.title} — authentic handloom saree`,
      openGraph: {
        title: `${product.title} — VaighaWeaves`,
        description: metadata?.description ?? product.subtitle ?? product.title,
        images: product.images?.[0]?.url
          ? [{ url: product.images[0].url }]
          : [],
      },
    }
  } catch {
    return {
      title: "Product — VaighaWeaves",
    }
  }
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { handle } = await params

  let product
  try {
    product = await getProduct(handle)
  } catch {
    notFound()
  }

  const metadata = await getProductMetadata(product.id)
  const sizes =
    metadata?.productType === "READYMADE"
      ? await getProductSizes(product.id)
      : []

  // JSON-LD structured data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: metadata?.description ?? product.subtitle ?? product.title,
    image: product.images?.map((i) => i.url) ?? [],
    brand: {
      "@type": "Brand",
      name: metadata?.brand ?? "VaighaWeaves",
    },
    offers: {
      "@type": "Offer",
      price:
        product.variants?.[0]?.calculated_price?.calculated_amount !== undefined
          ? product.variants[0].calculated_price!.calculated_amount / 100
          : undefined,
      priceCurrency: "INR",
      availability:
        (product.variants?.[0]?.inventory_quantity ?? 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductTemplate product={product} metadata={metadata} sizes={sizes} />
    </>
  )
}
