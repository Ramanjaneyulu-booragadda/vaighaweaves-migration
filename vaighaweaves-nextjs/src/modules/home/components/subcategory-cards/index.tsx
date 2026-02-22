import Image from "next/image"
import Link from "next/link"
import type { Category } from "@/types"

type SubcategoryCardsProps = {
  categories: Category[]
}

export default function SubcategoryCards({ categories }: SubcategoryCardsProps) {
  // Show top-level categories with their children as subcategory cards
  const topLevel = categories.filter((c) => !c.parent_category)
  if (!topLevel.length) return null

  return (
    <section className="py-8 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Explore Collections</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {topLevel.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.handle}`}
              className="group"
            >
              <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="relative aspect-square">
                  {category.thumbnail ? (
                    <Image
                      src={category.thumbnail}
                      alt={category.name}
                      fill
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      placeholder="blur"
                      blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect fill='%23f3f4f6' width='200' height='200'/%3E%3C/svg%3E"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/10 to-gold/10 flex items-center justify-center">
                      <span className="text-3xl">🧵</span>
                    </div>
                  )}
                </div>
                <div className="p-2 text-center">
                  <span className="text-xs font-medium text-gray-800 group-hover:text-primary line-clamp-1">
                    {category.name}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
