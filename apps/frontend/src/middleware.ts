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

  const hasRefreshToken = request.cookies.has("piece_rt")

  if (!hasRefreshToken && process.env.NODE_ENV !== "development") {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
