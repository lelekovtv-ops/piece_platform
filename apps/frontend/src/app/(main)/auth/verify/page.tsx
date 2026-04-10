"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { verifyEmailApi, getAccessToken } from "@/lib/auth/auth-client"
import Link from "next/link"

export default function VerifyPage() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const token = searchParams.get("token")
    const type = searchParams.get("type")

    if (!token) {
      setStatus("error")
      setMessage("No verification token provided")
      return
    }

    if (type === "email") {
      verifyEmailApi(token)
        .then(() => {
          setStatus("success")
          setMessage("Your email has been verified!")
          setTimeout(() => {
            window.location.href = getAccessToken() ? "/projects" : "/login"
          }, 2000)
        })
        .catch((err) => {
          setStatus("error")
          setMessage(err.message || "Verification link is invalid or expired")
        })
    } else {
      setStatus("error")
      setMessage("Unknown verification type")
    }
  }, [searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0E0D0C]">
      <div className="w-full max-w-sm text-center">
        <Link href="/home">
          <span className="text-[11px] font-bold tracking-[0.5em] text-white/20">PIECE</span>
        </Link>

        <div className="mt-10">
          {status === "loading" && (
            <div>
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#D4A853]" />
              <p className="mt-4 text-[13px] text-white/40">Verifying your email...</p>
            </div>
          )}

          {status === "success" && (
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="mt-4 text-[15px] font-medium text-[#E7E3DC]">{message}</p>
              <p className="mt-2 text-[12px] text-white/30">Redirecting to your workspace...</p>
            </div>
          )}

          {status === "error" && (
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="mt-4 text-[15px] font-medium text-[#E7E3DC]">{message}</p>
              <Link
                href="/login"
                className="mt-6 inline-block text-[12px] text-[#D4A853] hover:text-[#E8C778] transition-colors"
              >
                Go to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
