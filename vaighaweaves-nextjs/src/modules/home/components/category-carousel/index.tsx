"use client"

import { useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import type { Category } from "@/types"

type CategoryCarouselProps = {
  categories: Category[]
}

export default function CategoryCarousel({ categories }: CategoryCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 280
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  if (!categories.length) return null

  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Shop by Category</h2>
        <div className="relative">
          <button
            onClick={() => scroll("left")}
            aria-label="Scroll categories left"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-md rounded-full p-2 hover:bg-gray-50 hidden md:block"
          >
            &#8592;
          </button>
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
          >
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.handle}`}
                className="flex-shrink-0 group"
              >
                <div className="w-40 text-center">
                  <div className="relative w-40 h-40 rounded-full overflow-hidden bg-gray-100 mx-auto mb-3">
                    {category.thumbnail ? (
                      <Image
                        src={category.thumbnail}
                        alt={category.name}
                        fill
                        sizes="160px"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        placeholder="blur"
                        blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'%3E%3Crect fill='%23f3f4f6' width='160' height='160'/%3E%3C/svg%3E"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-gold/20 flex items-center justify-center">
                        <span className="text-2xl">🧵</span>
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-900 group-hover:text-primary">
                    {category.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <button
            onClick={() => scroll("right")}
            aria-label="Scroll categories right"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-md rounded-full p-2 hover:bg-gray-50 hidden md:block"
          >
            &#8594;
          </button>
        </div>
      </div>
    </section>
  )
}
