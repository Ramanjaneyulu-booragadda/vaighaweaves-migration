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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
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
