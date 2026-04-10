"use client"

import { useRouter } from "next/navigation"
import { LogOut, User, Settings } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useAuthStore } from "@/lib/auth/auth-store"
import { resendVerificationApi } from "@/lib/auth/auth-client"

export function UserMenu() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  if (!isAuthenticated || !user) {
    return (
      <button
        onClick={() => router.push("/login")}
        className="flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-white/40 transition-colors hover:bg-white/5 hover:text-white/60"
      >
        <User size={13} />
        Sign In
      </button>
    )
  }

  const initials = (user.name || user.email || "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("")

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D4A853]/20 text-[11px] font-semibold text-[#D4A853] transition-colors hover:bg-[#D4A853]/30"
        title={user.email || ""}
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-white/10 bg-[#1A1917]/95 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="px-3 py-2">
            <p className="text-[12px] font-medium text-[#E7E3DC]">{user.name}</p>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] text-white/30">{user.email}</p>
              {user.emailVerified ? (
                <span className="text-[9px] text-green-400/60">verified</span>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      await resendVerificationApi()
                      setVerificationSent(true)
                    } catch {
                      setVerificationSent(false)
                    }
                  }}
                  className={`text-[9px] transition-colors ${
                    verificationSent
                      ? "text-green-400/60"
                      : "text-amber-400/60 hover:text-amber-400"
                  }`}
                >
                  {verificationSent ? "sent!" : "unverified"}
                </button>
              )}
            </div>
          </div>
          <div className="my-1 h-px bg-white/8" />
          <button
            onClick={() => {
              setOpen(false)
              router.push("/settings")
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-white/40 transition-colors hover:bg-white/5 hover:text-white/60"
          >
            <Settings size={13} />
            Settings
          </button>
          <button
            onClick={async () => {
              await logout()
              router.push("/login")
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-white/40 transition-colors hover:bg-white/5 hover:text-white/60"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
