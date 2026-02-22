import { NextResponse } from "next/server"

const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const returnTo = searchParams.get("returnTo") || "/"

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const res = await fetch(`${MEDUSA_BACKEND_URL}/auth/customer/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  })

  if (!res.ok) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url))
  }

  const { token } = await res.json()

  const response = NextResponse.redirect(new URL(returnTo, request.url))
  response.cookies.set("_medusa_jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })

  return response
}
