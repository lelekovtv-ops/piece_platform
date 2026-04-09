"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useAuthStore } from "@/lib/auth/auth-store"

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Gallery", href: "#gallery" },
  { label: "How It Works", href: "#pipeline" },
]

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    const el = document.querySelector(href)
    el?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-300 flex h-16 items-center justify-between px-6 md:px-12 transition-all duration-300"
      style={{
        background: scrolled
          ? "rgba(11, 12, 16, 0.95)"
          : "transparent",
        backdropFilter: scrolled ? "blur(20px) saturate(1.4)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
      }}
    >
      {/* Logo */}
      <Link href="/home" className="flex items-center gap-2 group">
        <span
          className="text-[15px] font-semibold tracking-[0.35em] transition-colors duration-300"
          style={{ color: "rgba(255,255,255,0.25)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#D4A853")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
        >
          PIECE
        </span>
      </Link>

      {/* Center nav links */}
      <div className="hidden md:flex items-center gap-8">
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={(e) => handleAnchorClick(e, link.href)}
            className="text-[13px] font-medium tracking-wider transition-colors duration-200"
            style={{ color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
          >
            {link.label}
          </a>
        ))}
      </div>

      {/* CTA */}
      <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <Link
            href="/projects"
            className="landing-btn-primary text-[13px] font-medium px-5 py-2 rounded-full transition-all duration-200"
          >
            Go to Studio
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="text-[13px] font-medium px-4 py-2 rounded-full transition-colors duration-200"
              style={{ color: "rgba(255,255,255,0.5)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
            >
              Log in
            </Link>
            <Link
              href="/login"
              className="landing-btn-primary text-[13px] font-medium px-5 py-2 rounded-full transition-all duration-200"
            >
              Get Started
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
