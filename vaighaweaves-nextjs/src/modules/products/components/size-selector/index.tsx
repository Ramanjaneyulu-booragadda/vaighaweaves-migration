"use client"

import { useState } from "react"
import type { ProductSize } from "@/types"

type SizeSelectorProps = {
  sizes: ProductSize[]
  onSizeSelect?: (size: ProductSize | null) => void
}

export default function SizeSelector({
  sizes,
  onSizeSelect,
}: SizeSelectorProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null)

  if (!sizes.length) return null

  const handleSelect = (size: ProductSize) => {
    if (size.inventoryQuantity === 0) return
    const newSize = selectedSize === size.size ? null : size.size
    setSelectedSize(newSize)
    onSizeSelect?.(newSize ? size : null)
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900">
          Size
          {selectedSize && (
            <span className="ml-2 font-normal text-gray-500">
              — {selectedSize}
            </span>
          )}
        </h3>
        <a
          href="#size-guide"
          className="text-xs text-primary hover:underline"
        >
          Size guide
        </a>
      </div>
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => {
          const isSelected = selectedSize === size.size
          const isOutOfStock = size.inventoryQuantity === 0
          return (
            <button
              key={size.variantId}
              onClick={() => handleSelect(size)}
              disabled={isOutOfStock}
              aria-label={`Size ${size.size}${isOutOfStock ? " — out of stock" : ""}`}
              aria-pressed={isSelected}
              className={`
                px-4 py-2 text-sm rounded-md border font-medium transition-colors
                ${
                  isOutOfStock
                    ? "border-gray-200 text-gray-300 cursor-not-allowed line-through"
                    : isSelected
                    ? "border-primary bg-primary text-white"
                    : "border-gray-300 text-gray-700 hover:border-primary hover:text-primary"
                }
              `}
            >
              {size.size}
            </button>
          )
        })}
      </div>
      {selectedSize && (
        <p className="mt-2 text-xs text-green-600">
          ✓ Size {selectedSize} selected
        </p>
      )}
    </div>
  )
}
