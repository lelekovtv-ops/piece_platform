import { NextRequest, NextResponse } from "next/server"

const PUBLIC_ROUTES = ["/login", "/healthz", "/home", "/auth/verify"]

const PUBLIC_PREFIXES = ["/_next/", "/api/", "/favicon.ico"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (
    PUBLIC_ROUTES.some(
      (r) => pathname === r || pathname.startsWith(r + "/"),
    )
  ) {
    return NextResponse.next()
  }

  // In development, cookie is set by backend on a different port (cross-origin),
  // so it won't be visible here. AuthProvider handles client-side protection.
  // In production, frontend and backend share the same domain via Nginx proxy,
  // so the cookie is visible and server-side redirect works.
  const isDev = process.env.NODE_ENV === "development"
  if (isDev) {
    return NextResponse.next()
  }

  const hasRefreshToken = request.cookies.has("piece_rt")

  if (!hasRefreshToken) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
