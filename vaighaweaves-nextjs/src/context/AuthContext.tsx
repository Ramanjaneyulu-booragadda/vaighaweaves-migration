"use client"

import React, { createContext, useContext, useState } from "react"

export interface SafeUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  role?: string
  avatar?: string
}

interface AuthContextType {
  user: SafeUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loginWithGoogle: (idToken: string) => Promise<void>
  updateUser: (data: Partial<SafeUser>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode
  initialUser?: SafeUser | null
}) {
  const [user, setUser] = useState<SafeUser | null>(initialUser)
  const [loading, setLoading] = useState(false)

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Login failed")
      }
      const data = await res.json()
      setUser(data.user)
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const loginWithGoogle = async (idToken: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/callback?code=${encodeURIComponent(idToken)}`, {
        method: "GET",
      })
      if (!res.ok) throw new Error("Google login failed")
      const data = await res.json()
      setUser(data.user)
    } finally {
      setLoading(false)
    }
  }

  const updateUser = (data: Partial<SafeUser>) => {
    setUser((prev) => (prev ? { ...prev, ...data } : null))
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, loginWithGoogle, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
