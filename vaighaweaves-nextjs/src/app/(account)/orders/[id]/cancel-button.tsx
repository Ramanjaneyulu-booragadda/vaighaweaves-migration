"use client"

import { useState } from "react"

interface CancelOrderButtonProps {
  orderId: string
}

/**
 * CancelOrderButton — Client Component that displays a confirmation modal
 * before cancelling an order.
 */
export default function CancelOrderButton({ orderId }: CancelOrderButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCancel = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // TODO: wire to Medusa cancel-order server action when available
      // await cancelOrder(orderId)
      await new Promise((r) => setTimeout(r, 800)) // placeholder
      setIsOpen(false)
    } catch (err: any) {
      setError(err.message ?? "Failed to cancel order")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-sm text-red-600 hover:text-red-700 font-medium border border-red-200 rounded-md px-3 py-1 hover:bg-red-50 transition-colors"
      >
        Cancel Order
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
        >
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3
              id="cancel-dialog-title"
              className="text-lg font-semibold text-gray-900 mb-2"
            >
              Cancel Order?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to cancel this order? This action cannot be
              undone.
            </p>

            {error && (
              <p className="text-sm text-red-500 mb-4" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-x-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
                className="flex-1 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
              >
                {isLoading ? "Cancelling…" : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
