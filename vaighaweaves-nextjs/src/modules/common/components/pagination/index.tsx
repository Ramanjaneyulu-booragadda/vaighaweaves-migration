"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"

type PaginationProps = {
  total: number
  pageSize?: number
}

export default function Pagination({ total, pageSize = 12 }: PaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentPage = parseInt(searchParams.get("page") ?? "1", 10)
  const totalPages = Math.ceil(total / pageSize)

  if (totalPages <= 1) return null

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", page.toString())
    router.push(`${pathname}?${params.toString()}`)
  }

  const pages: (number | "ellipsis")[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else if (currentPage <= 4) {
    pages.push(1, 2, 3, 4, 5, "ellipsis", totalPages)
  } else if (currentPage >= totalPages - 3) {
    pages.push(
      1,
      "ellipsis",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages
    )
  } else {
    pages.push(
      1,
      "ellipsis",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "ellipsis",
      totalPages
    )
  }

  return (
    <nav
      className="flex justify-center items-center gap-2 mt-12"
      aria-label="Pagination"
    >
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 text-sm rounded-md border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
        aria-label="Previous page"
      >
        &#8592;
      </button>
      {pages.map((page, idx) =>
        page === "ellipsis" ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-gray-500">
            &hellip;
          </span>
        ) : (
          <button
            key={page}
            onClick={() => goToPage(page)}
            disabled={page === currentPage}
            className={`px-3 py-2 text-sm rounded-md border ${
              page === currentPage
                ? "bg-primary text-white border-primary font-semibold"
                : "border-gray-300 hover:bg-gray-50"
            }`}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </button>
        )
      )}
      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 text-sm rounded-md border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
        aria-label="Next page"
      >
        &#8594;
      </button>
    </nav>
  )
}
