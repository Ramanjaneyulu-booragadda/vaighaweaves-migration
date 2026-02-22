import { createHash } from "crypto"
import { NextRequest, NextResponse } from "next/server"

/** Produces a stable, non-reversible token from the gate password. */
function hashGatePassword(password: string): string {
  return createHash("sha256").update(password).digest("hex")
}

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  if (password !== process.env.DEV_GATE_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Store a hash of the password rather than the plaintext value.
  const token = hashGatePassword(password)

  const response = NextResponse.json({ ok: true })
  response.cookies.set("_dev_gate", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  })

  return response
}
