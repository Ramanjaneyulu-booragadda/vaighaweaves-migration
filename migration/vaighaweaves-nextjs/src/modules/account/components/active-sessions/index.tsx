"use client"

import { useState, useEffect } from "react"

interface Session {
  id: string
  device: string
  location?: string
  lastActive: string
  current: boolean
}

/**
 * ActiveSessions — shows the customer's active login sessions and allows
 * remote logout of individual sessions.
 *
 * Ported from vaighaweaves-ui/src/components/ActiveSessions.tsx.
 *
 * TODO: wire to Medusa token management API when available in the backend.
 */
export default function ActiveSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Placeholder — replace with real API call once Medusa supports
    // session management endpoints.
    const mockSessions: Session[] = [
      {
        id: "current",
        device: "This device",
        lastActive: new Date().toISOString(),
        current: true,
      },
    ]
    setSessions(mockSessions)
    setIsLoading(false)
  }, [])

  const handleLogout = async (sessionId: string) => {
    setError(null)
    try {
      // TODO: call revoke-session server action
      // await revokeSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    } catch (err: any) {
      setError(err.message ?? "Failed to log out session")
    }
  }

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500">Loading sessions…</div>
    )
  }

  return (
    <div className="flex flex-col gap-y-4">
      <h3 className="text-base font-semibold text-gray-900">
        Active Sessions
      </h3>

      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">
                {session.device}
                {session.current && (
                  <span className="ml-2 text-xs text-green-600 font-normal">
                    (current)
                  </span>
                )}
              </p>
              {session.location && (
                <p className="text-xs text-gray-500">{session.location}</p>
              )}
              <p className="text-xs text-gray-400">
                Last active:{" "}
                {new Date(session.lastActive).toLocaleString("en-IN")}
              </p>
            </div>

            {!session.current && (
              <button
                type="button"
                onClick={() => handleLogout(session.id)}
                className="text-xs text-red-600 hover:text-red-700 font-medium border border-red-200 rounded px-2 py-1 hover:bg-red-50 transition-colors"
              >
                Log out
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
