"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { useCollaboration } from "@/hooks/useCollaboration"
import { useAuthStore } from "@/lib/auth/auth-store"

function CollaborationBridge() {
  useCollaboration()
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize)
  const isLoading = useAuthStore((s) => s.isLoading)

  useEffect(() => {
    initialize()
  }, [initialize])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E0D0C]">
        <div className="text-sm text-white/30">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <CollaborationBridge />
      {children}
    </>
  )
}
