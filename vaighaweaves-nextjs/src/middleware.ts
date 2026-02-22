import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PROTECTED_PATHS = [
  "/dashboard",
  "/orders",
  "/profile",
  "/wishlist",
  "/payment",
]
const AUTH_ONLY_PATHS = ["/login", "/register"]

/** Produces a stable hex token from the gate password using the Web Crypto API (Edge-compatible). */
async function hashGatePassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Maintenance mode ────────────────────────────────────────────────────────
  const IS_MAINTENANCE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true"
  if (IS_MAINTENANCE && pathname !== "/maintenance") {
    const isAuthPath =
      pathname.startsWith("/login") || pathname.startsWith("/api/auth")
    if (!isAuthPath) {
      const ALLOW_ADMIN_BYPASS =
        process.env.NEXT_PUBLIC_ADMIN_BYPASS === "true"
      const isAdminBypass =
        request.cookies.get("_admin_bypass")?.value ===
        process.env.ADMIN_BYPASS_SECRET
      if (!ALLOW_ADMIN_BYPASS || !isAdminBypass) {
        return NextResponse.rewrite(new URL("/maintenance", request.url))
      }
    }
  }

  // ── DevSiteGate — password protection for staging ──────────────────────────
  const DEV_GATE = process.env.NEXT_PUBLIC_ENABLE_DEV_GATE === "true"
  if (DEV_GATE && pathname !== "/dev-gate") {
    const gateBypass = request.cookies.get("_dev_gate")?.value
    const expectedToken = process.env.DEV_GATE_PASSWORD
      ? await hashGatePassword(process.env.DEV_GATE_PASSWORD)
      : undefined
    if (
      gateBypass !== expectedToken &&
      !pathname.startsWith("/api/auth/gate")
    ) {
      return NextResponse.rewrite(new URL("/dev-gate", request.url))
    }
  }

  const session = request.cookies.get("_medusa_jwt")?.value

  // Protected: require session
  if (PROTECTED_PATHS.some((p) => pathname.startsWith(p))) {
    if (!session) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("returnTo", pathname)
      return NextResponse.redirect(url)
    }
  }

  // Auth-only: redirect away if already logged in
  if (AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    if (session) {
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
}
