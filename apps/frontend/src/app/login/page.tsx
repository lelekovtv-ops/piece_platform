"use client"

import { useState } from "react"
import { useAuthStore } from "@/lib/auth/auth-store"
import Link from "next/link"

export default function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (isRegister) {
        await register(email, password, name || undefined)
      } else {
        await login(email, password)
      }
      window.location.href = "/projects"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left — cinematic visual */}
      <div className="relative hidden w-1/2 lg:block">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #0a0a0a 0%, #1a1510 40%, #0d0b08 100%)",
          }}
        />

        {/* Film grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Cinematic content */}
        <div className="relative flex h-full flex-col justify-between p-12">
          {/* Top — logo */}
          <Link href="/home">
            <span
              className="text-[11px] font-bold tracking-[0.5em] text-white/20 transition-colors hover:text-[#D4A853]"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              PIECE
            </span>
          </Link>

          {/* Center — visual */}
          <div className="flex flex-col items-center justify-center gap-8">
            {/* Storyboard grid */}
            <div className="grid grid-cols-3 gap-2 opacity-60">
              {[
                "linear-gradient(145deg, #2a1f14 0%, #1a1510 100%)",
                "linear-gradient(145deg, #1a1510 0%, #0d0b08 100%)",
                "linear-gradient(145deg, #2a1f14 0%, #1a1510 100%)",
                "linear-gradient(145deg, #0d0b08 0%, #1a1510 100%)",
                "linear-gradient(145deg, #D4A853 0%, #8a6d2f 100%)",
                "linear-gradient(145deg, #1a1510 0%, #0d0b08 100%)",
                "linear-gradient(145deg, #1a1510 0%, #2a1f14 100%)",
                "linear-gradient(145deg, #0d0b08 0%, #1a1510 100%)",
                "linear-gradient(145deg, #2a1f14 0%, #0d0b08 100%)",
              ].map((bg, i) => (
                <div
                  key={i}
                  className="aspect-[16/9] w-[120px] rounded-sm"
                  style={{ background: bg }}
                />
              ))}
            </div>

            {/* Tagline */}
            <div className="text-center">
              <p
                className="text-[28px] font-light tracking-tight text-white/70"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Cinematic AI Production
              </p>
              <p className="mt-2 text-[13px] text-white/25">
                From screenplay to screen. Powered by intelligence.
              </p>
            </div>
          </div>

          {/* Bottom — film strip decoration */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[3px] w-[3px] rounded-full"
                  style={{ background: i === 4 ? "#D4A853" : "rgba(255,255,255,0.08)" }}
                />
              ))}
            </div>
            <span className="text-[10px] tracking-[0.3em] text-white/10">
              SCENE 01 &middot; TAKE 01
            </span>
          </div>
        </div>
      </div>

      {/* Right — auth form */}
      <div className="flex w-full flex-col items-center justify-center bg-[#0E0D0C] px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile-only logo */}
          <div className="mb-10 lg:hidden">
            <Link href="/home">
              <span className="text-[11px] font-bold tracking-[0.5em] text-white/20">
                PIECE
              </span>
            </Link>
          </div>

          <h1 className="mb-1 text-[22px] font-semibold tracking-tight text-[#E7E3DC]">
            {isRegister ? "Create Account" : "Welcome back"}
          </h1>
          <p className="mb-8 text-[13px] text-white/30">
            {isRegister
              ? "Start your cinematic journey"
              : "Sign in to your studio"}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {isRegister && (
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[14px] text-[#E7E3DC] placeholder:text-white/20 outline-none focus:border-[#D4A853]/40 transition-colors"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[14px] text-[#E7E3DC] placeholder:text-white/20 outline-none focus:border-[#D4A853]/40 transition-colors"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[14px] text-[#E7E3DC] placeholder:text-white/20 outline-none focus:border-[#D4A853]/40 transition-colors"
            />

            {error && (
              <p className="text-[12px] text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-lg bg-[#D4A853] px-4 py-3 text-[13px] font-medium text-[#0E0D0C] transition-colors hover:bg-[#E8C778] disabled:opacity-50"
            >
              {loading ? "..." : isRegister ? "Create Account" : "Sign In"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError("") }}
            className="mt-5 w-full text-center text-[12px] text-white/30 transition-colors hover:text-white/50"
          >
            {isRegister
              ? "Already have an account? Sign in"
              : "Don't have an account? Register"}
          </button>

          <div className="mt-8 text-center">
            <Link
              href="/home"
              className="text-[11px] text-white/15 transition-colors hover:text-white/30"
            >
              &larr; Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
