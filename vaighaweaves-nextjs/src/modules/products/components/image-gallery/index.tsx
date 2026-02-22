"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import type { ProductWithMetadata } from "@/types"

const ImageSwiper = dynamic(() => import("./image-swiper"), { ssr: false })

type ImageGalleryProps = {
  product: ProductWithMetadata
}

export default function ImageGallery({ product }: ImageGalleryProps) {
  const images = product.images ?? []
  const [activeIndex, setActiveIndex] = useState(0)

  if (!images.length) return null

  return (
    <div className="flex flex-col gap-4">
      {/* Main Swiper */}
      <ImageSwiper
        images={images}
        activeIndex={activeIndex}
        onSlideChange={setActiveIndex}
      />
      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => setActiveIndex(idx)}
              aria-label={`View image ${idx + 1}`}
              className={`relative w-16 h-16 flex-shrink-0 rounded overflow-hidden border-2 transition-colors ${
                activeIndex === idx
                  ? "border-primary"
                  : "border-transparent hover:border-gray-300"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={`Thumbnail ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
