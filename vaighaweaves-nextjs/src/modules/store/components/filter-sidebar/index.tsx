"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback } from "react"

const FABRIC_OPTIONS = [
  "Silk",
  "Cotton",
  "Linen",
  "Georgette",
  "Chiffon",
  "Crepe",
  "Net",
  "Organza",
]

const OCCASION_OPTIONS = [
  "Wedding",
  "Party",
  "Casual",
  "Office",
  "Festival",
  "Traditional",
]

const SORT_OPTIONS = [
  { label: "Newest First", value: "created_at" },
  { label: "Price: Low to High", value: "variants.calculated_price" },
  { label: "Price: High to Low", value: "-variants.calculated_price" },
  { label: "Name: A–Z", value: "title" },
]

const PRICE_RANGES = [
  { label: "Under ₹1,000", min: "0", max: "100000" },
  { label: "₹1,000 – ₹3,000", min: "100000", max: "300000" },
  { label: "₹3,000 – ₹7,000", min: "300000", max: "700000" },
  { label: "₹7,000 – ₹15,000", min: "700000", max: "1500000" },
  { label: "Above ₹15,000", min: "1500000", max: "" },
]

export default function FilterSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      // Reset page when filters change
      params.delete("page")
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const clearFilters = () => {
    router.push(pathname)
  }

  const currentFabric = searchParams.get("fabric") ?? ""
  const currentOccasion = searchParams.get("occasion") ?? ""
  const currentSort = searchParams.get("sort") ?? ""
  const currentPriceMin = searchParams.get("priceMin") ?? ""
  const currentPriceMax = searchParams.get("priceMax") ?? ""

  return (
    <aside className="w-full md:w-64 shrink-0">
      <div className="sticky top-20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          <button
            onClick={clearFilters}
            className="text-sm text-primary hover:underline"
          >
            Clear all
          </button>
        </div>

        {/* Sort */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Sort By</h3>
          <select
            value={currentSort}
            onChange={(e) => setParam("sort", e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Default</option>
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Fabric */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Fabric</h3>
          <div className="space-y-2">
            {FABRIC_OPTIONS.map((fabric) => (
              <label key={fabric} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="fabric"
                  value={fabric}
                  checked={currentFabric === fabric}
                  onChange={() =>
                    setParam("fabric", currentFabric === fabric ? "" : fabric)
                  }
                  className="text-primary"
                />
                <span className="text-sm text-gray-700">{fabric}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Occasion */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Occasion</h3>
          <div className="space-y-2">
            {OCCASION_OPTIONS.map((occasion) => (
              <label key={occasion} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="occasion"
                  value={occasion}
                  checked={currentOccasion === occasion}
                  onChange={() =>
                    setParam(
                      "occasion",
                      currentOccasion === occasion ? "" : occasion
                    )
                  }
                  className="text-primary"
                />
                <span className="text-sm text-gray-700">{occasion}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            Price Range
          </h3>
          <div className="space-y-2">
            {PRICE_RANGES.map((range) => {
              const isSelected =
                currentPriceMin === range.min &&
                currentPriceMax === range.max
              return (
                <label
                  key={range.label}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="priceRange"
                    checked={isSelected}
                    onChange={() => {
                      if (isSelected) {
                        const params = new URLSearchParams(
                          searchParams.toString()
                        )
                        params.delete("priceMin")
                        params.delete("priceMax")
                        params.delete("page")
                        router.push(`${pathname}?${params.toString()}`)
                      } else {
                        const params = new URLSearchParams(
                          searchParams.toString()
                        )
                        params.set("priceMin", range.min)
                        if (range.max) params.set("priceMax", range.max)
                        else params.delete("priceMax")
                        params.delete("page")
                        router.push(`${pathname}?${params.toString()}`)
                      }
                    }}
                    className="text-primary"
                  />
                  <span className="text-sm text-gray-700">{range.label}</span>
                </label>
              )
            })}
          </div>
        </div>
      </div>
    </aside>
  )
}
