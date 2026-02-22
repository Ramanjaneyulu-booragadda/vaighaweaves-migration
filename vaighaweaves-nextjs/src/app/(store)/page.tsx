import type { Metadata } from "next"
import {
  getFeaturedProducts,
  getDeals,
  getTrending,
  getCategories,
} from "@lib/data/products"
import HeroSection from "@modules/home/components/hero-section"
import CategoryCarousel from "@modules/home/components/category-carousel"
import ProductCarousel from "@modules/home/components/product-carousel"
import SubcategoryCards from "@modules/home/components/subcategory-cards"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "VaighaWeaves — Premium Handloom Sarees",
  description:
    "Shop authentic handloom sarees, silk sarees, and traditional Indian weaves directly from master weavers. Free shipping across India.",
  openGraph: {
    images: ["/opengraph-image.jpg"],
    title: "VaighaWeaves — Premium Handloom Sarees",
    description:
      "Shop authentic handloom sarees, silk sarees, and traditional Indian weaves directly from master weavers.",
  },
}

export default async function HomePage() {
  const [featured, deals, trending, categories] = await Promise.all([
    getFeaturedProducts(6).catch(() => []),
    getDeals(4).catch(() => []),
    getTrending(4).catch(() => []),
    getCategories().catch(() => []),
  ])

  return (
    <>
      <HeroSection />
      <CategoryCarousel categories={categories} />
      <ProductCarousel title="Featured" products={featured} />
      <ProductCarousel title="Deals of the Day" products={deals} />
      <ProductCarousel title="Trending" products={trending} />
      <SubcategoryCards categories={categories} />
    </>
  )
}
