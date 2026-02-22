"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function DevGatePage() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await fetch("/api/auth/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.refresh()
    } else {
      setError("Incorrect password. Please try again.")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ui-bg-base px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-ui-fg-base mb-2">
            VaighaWeaves — Staging
          </h1>
          <p className="text-ui-fg-subtle text-sm">
            This is a private staging environment. Enter the password to
            continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
            className="w-full rounded-md border border-ui-border-base px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ui-fg-base"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-ui-fg-base text-ui-bg-base py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Checking…" : "Enter Site"}
          </button>
        </form>
      </div>
    </div>
  )
}
