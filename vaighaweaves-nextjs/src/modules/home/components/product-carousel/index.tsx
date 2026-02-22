"use client"

import dynamic from "next/dynamic"
import type { ProductWithMetadata } from "@/types"

const SwiperWrapper = dynamic(() => import("./swiper-wrapper"), { ssr: false })

type ProductCarouselProps = {
  title: string
  products: ProductWithMetadata[]
}

export default function ProductCarousel({
  title,
  products,
}: ProductCarouselProps) {
  if (!products.length) return null

  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>
        <SwiperWrapper products={products} />
      </div>
    </section>
  )
}
