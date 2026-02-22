import Image from "next/image"
import Link from "next/link"
import type { ProductWithMetadata } from "@/types"

type ProductGridProps = {
  products: ProductWithMetadata[]
}

export default function ProductGrid({ products }: ProductGridProps) {
  if (!products.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <p className="text-lg font-medium">No products found</p>
        <p className="text-sm mt-2">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {products.map((product) => (
        <Link
          key={product.id}
          href={`/product/${product.handle}`}
          className="group"
          data-testid="product-card"
        >
          <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-100">
            {product.thumbnail ? (
              <Image
                src={product.thumbnail}
                alt={product.title}
                fill
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 25vw"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                placeholder="blur"
                blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 400'%3E%3Crect fill='%23f3f4f6' width='300' height='400'/%3E%3C/svg%3E"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <span className="text-4xl">🧵</span>
              </div>
            )}
          </div>
          <div className="mt-3">
            <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-primary">
              {product.title}
            </h3>
            {product.variants?.[0]?.calculated_price && (
              <p className="mt-1 text-sm font-semibold text-gray-900">
                ₹
                {(
                  product.variants[0].calculated_price.calculated_amount / 100
                ).toLocaleString("en-IN")}
              </p>
            )}
            {product.categories?.[0] && (
              <p className="mt-0.5 text-xs text-gray-500">
                {product.categories[0].name}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
