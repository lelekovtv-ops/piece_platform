export const PUBLIC_ROUTES = [
  "/login",
  "/healthz",
  "/home",
  "/",
  "/auth/verify",
  "/auth/forgot-password",
  "/auth/reset-password",
]

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  )
}
