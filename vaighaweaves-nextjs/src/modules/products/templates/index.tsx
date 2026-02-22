import Link from "next/link"
import ImageGallery from "@modules/products/components/image-gallery"
import SizeSelector from "@modules/products/components/size-selector"
import type { ProductMetadata, ProductSize, ProductWithMetadata } from "@/types"

type ProductTemplateProps = {
  product: ProductWithMetadata
  metadata: ProductMetadata | null
  sizes?: ProductSize[]
}

export default function ProductTemplate({
  product,
  metadata,
  sizes = [],
}: ProductTemplateProps) {
  const price = product.variants?.[0]?.calculated_price
  const isReadymade = metadata?.productType === "READYMADE"
  const inStock =
    (product.variants?.[0]?.inventory_quantity ?? 0) > 0 ||
    (sizes.length > 0 && sizes.some((s) => s.inventoryQuantity > 0))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-primary">
          Shop
        </Link>
        {product.categories?.[0] && (
          <>
            <span>/</span>
            <Link
              href={`/categories/${product.categories[0].handle}`}
              className="hover:text-primary"
            >
              {product.categories[0].name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-gray-900 font-medium line-clamp-1">
          {product.title}
        </span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Image Gallery */}
        <div>
          <ImageGallery product={product} />
        </div>

        {/* Product Info */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {product.title}
            </h1>
            {product.subtitle && (
              <p className="mt-1 text-gray-600">{product.subtitle}</p>
            )}
          </div>

          {/* Price */}
          {price && (
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-gray-900">
                ₹{(price.calculated_amount / 100).toLocaleString("en-IN")}
              </span>
              <span className="text-sm text-gray-500">Inclusive of all taxes</span>
            </div>
          )}

          {/* Stock Badge */}
          <div>
            {inStock ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                In Stock
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Out of Stock
              </span>
            )}
          </div>

          {/* Size Selector — only for READYMADE products */}
          {isReadymade && sizes.length > 0 && (
            <SizeSelector sizes={sizes} />
          )}

          {/* Product Metadata */}
          {metadata && (
            <div className="grid grid-cols-2 gap-3 text-sm border-t border-gray-200 pt-4">
              {metadata.fabric && (
                <div>
                  <span className="text-gray-500">Fabric:</span>{" "}
                  <span className="font-medium">{metadata.fabric}</span>
                </div>
              )}
              {metadata.weaveType && (
                <div>
                  <span className="text-gray-500">Weave:</span>{" "}
                  <span className="font-medium">{metadata.weaveType}</span>
                </div>
              )}
              {metadata.zariType && (
                <div>
                  <span className="text-gray-500">Zari:</span>{" "}
                  <span className="font-medium">{metadata.zariType}</span>
                </div>
              )}
              {metadata.occasion && (
                <div>
                  <span className="text-gray-500">Occasion:</span>{" "}
                  <span className="font-medium">{metadata.occasion}</span>
                </div>
              )}
              {metadata.blouseLength && (
                <div>
                  <span className="text-gray-500">Blouse Length:</span>{" "}
                  <span className="font-medium">{metadata.blouseLength}</span>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {(metadata?.description ?? product.description) && (
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Description
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {metadata?.description ?? product.description}
              </p>
            </div>
          )}

          {/* Care Instructions */}
          {metadata?.careInstructions && (
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Care Instructions
              </h3>
              <p className="text-sm text-gray-600">{metadata.careInstructions}</p>
            </div>
          )}

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                >
                  {tag.value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
