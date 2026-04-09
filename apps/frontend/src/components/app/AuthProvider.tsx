"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useCollaboration } from "@/hooks/useCollaboration"
import { useAuthStore } from "@/lib/auth/auth-store"

const PUBLIC_ROUTES = ["/login", "/healthz", "/home", "/"]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"))
}

function CollaborationBridge() {
  useCollaboration()
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize)
  const isLoading = useAuthStore((s) => s.isLoading)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated && !isPublicRoute(pathname)) {
      router.replace("/login")
    }

    if (isAuthenticated && pathname === "/login") {
      router.replace("/projects")
    }
  }, [isLoading, isAuthenticated, pathname, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E0D0C]">
        <div className="text-sm text-white/30">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated && !isPublicRoute(pathname)) {
    return null
  }

  return (
    <>
      <CollaborationBridge />
      {children}
    </>
  )
}
