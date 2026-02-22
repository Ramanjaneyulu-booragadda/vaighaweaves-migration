"use client"

import { Swiper, SwiperSlide } from "swiper/react"
import { Navigation, Pagination, A11y } from "swiper/modules"
import Image from "next/image"
import Link from "next/link"
import type { ProductWithMetadata } from "@/types"

// Swiper CSS
import "swiper/css"
import "swiper/css/navigation"
import "swiper/css/pagination"

type SwiperWrapperProps = {
  products: ProductWithMetadata[]
}

export default function SwiperWrapper({ products }: SwiperWrapperProps) {
  return (
    <Swiper
      modules={[Navigation, Pagination, A11y]}
      spaceBetween={16}
      slidesPerView={1}
      navigation
      pagination={{ clickable: true }}
      breakpoints={{
        640: { slidesPerView: 2 },
        768: { slidesPerView: 3 },
        1024: { slidesPerView: 4 },
      }}
      className="pb-10"
    >
      {products.map((product) => (
        <SwiperSlide key={product.id}>
          <Link href={`/product/${product.handle}`} className="group block">
            <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-100">
              {product.thumbnail && (
                <Image
                  src={product.thumbnail}
                  alt={product.title}
                  fill
                  sizes="(max-width: 640px) 300px, (max-width: 1024px) 250px, 300px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  placeholder="blur"
                  blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 400'%3E%3Crect fill='%23f3f4f6' width='300' height='400'/%3E%3C/svg%3E"
                />
              )}
            </div>
            <div className="mt-3">
              <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
                {product.title}
              </h3>
              {product.variants?.[0]?.calculated_price && (
                <p className="mt-1 text-sm font-semibold text-primary">
                  ₹
                  {(
                    product.variants[0].calculated_price.calculated_amount / 100
                  ).toLocaleString("en-IN")}
                </p>
              )}
            </div>
          </Link>
        </SwiperSlide>
      ))}
    </Swiper>
  )
}
