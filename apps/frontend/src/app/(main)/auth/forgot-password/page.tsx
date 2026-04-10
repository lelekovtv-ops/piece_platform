"use client"

import { useState } from "react"
import { requestPasswordResetApi } from "@/lib/auth/auth-client"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await requestPasswordResetApi(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0E0D0C] px-6">
      <div className="w-full max-w-sm">
        <Link href="/home">
          <span className="text-[11px] font-bold tracking-[0.5em] text-white/20">PIECE</span>
        </Link>

        <h1 className="mt-10 mb-1 text-[22px] font-semibold tracking-tight text-[#E7E3DC]">
          Reset password
        </h1>
        <p className="mb-8 text-[13px] text-white/30">
          Enter your email and we&apos;ll send you a reset link
        </p>

        {sent ? (
          <div>
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
              <p className="text-[13px] text-green-400">
                If an account with that email exists, we&apos;ve sent a password reset link. Check your inbox.
              </p>
            </div>
            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="text-[12px] text-[#D4A853] hover:text-[#E8C778] transition-colors"
              >
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[14px] text-[#E7E3DC] placeholder:text-white/20 outline-none focus:border-[#D4A853]/40 transition-colors"
            />

            {error && <p className="text-[12px] text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-lg bg-[#D4A853] px-4 py-3 text-[13px] font-medium text-[#0E0D0C] transition-colors hover:bg-[#E8C778] disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border border-[#0E0D0C]/30 border-t-[#0E0D0C]" />
                  Sending...
                </span>
              ) : (
                "Send Reset Link"
              )}
            </button>

            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="text-[12px] text-white/30 hover:text-white/50 transition-colors"
              >
                Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
