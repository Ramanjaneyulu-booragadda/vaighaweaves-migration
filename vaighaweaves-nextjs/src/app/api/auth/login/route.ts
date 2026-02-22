import { NextResponse } from "next/server"

const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_PUBLISHABLE_KEY || ""

export async function POST(request: Request) {
  const { email, password } = await request.json()

  const res = await fetch(`${MEDUSA_BACKEND_URL}/auth/customer/emailpass`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: { "Content-Type": "application/json" },
  })

  if (!res.ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const data = await res.json()
  const { token } = data
  const customer = data.customer ?? {}

  const response = NextResponse.json({
    user: {
      id: customer.id,
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
    },
  })

  response.cookies.set("_medusa_jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })

  return response
}
