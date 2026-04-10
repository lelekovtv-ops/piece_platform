"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { confirmPasswordResetApi } from "@/lib/auth/auth-client"
import Link from "next/link"

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (!token) {
      setError("Invalid reset link")
      return
    }

    setLoading(true)

    try {
      await confirmPasswordResetApi(token, newPassword)
      setSuccess(true)
      setTimeout(() => {
        window.location.href = "/login"
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E0D0C]">
        <div className="text-center">
          <p className="text-[15px] text-[#E7E3DC]">Invalid or missing reset link</p>
          <Link href="/login" className="mt-4 inline-block text-[12px] text-[#D4A853] hover:text-[#E8C778]">
            Go to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0E0D0C] px-6">
      <div className="w-full max-w-sm">
        <Link href="/home">
          <span className="text-[11px] font-bold tracking-[0.5em] text-white/20">PIECE</span>
        </Link>

        <h1 className="mt-10 mb-1 text-[22px] font-semibold tracking-tight text-[#E7E3DC]">
          Set new password
        </h1>
        <p className="mb-8 text-[13px] text-white/30">
          Choose a strong password for your account
        </p>

        {success ? (
          <div>
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
              <p className="text-[13px] text-green-400">
                Password reset successfully! Redirecting to login...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[14px] text-[#E7E3DC] placeholder:text-white/20 outline-none focus:border-[#D4A853]/40 transition-colors"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[14px] text-[#E7E3DC] placeholder:text-white/20 outline-none focus:border-[#D4A853]/40 transition-colors"
            />

            <p className="text-[11px] text-white/20">Minimum 8 characters</p>

            {error && <p className="text-[12px] text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-lg bg-[#D4A853] px-4 py-3 text-[13px] font-medium text-[#0E0D0C] transition-colors hover:bg-[#E8C778] disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border border-[#0E0D0C]/30 border-t-[#0E0D0C]" />
                  Resetting...
                </span>
              ) : (
                "Reset Password"
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
