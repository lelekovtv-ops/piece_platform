"use client"

import Link from "next/link"
import { useAuthStore } from "@/lib/auth/auth-store"

export function HeroSection() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const handleExplore = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    document.querySelector("#gallery")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <section className="relative flex flex-col items-center justify-center min-h-screen px-6 overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(212,168,83,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,168,83,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 40%, rgba(212,168,83,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-200">
        {/* Badge */}
        <div
          className="mb-6 px-4 py-1.5 rounded-full text-[11px] font-medium tracking-widest uppercase"
          style={{
            border: "1px solid rgba(212,168,83,0.2)",
            color: "rgba(212,168,83,0.7)",
            background: "rgba(212,168,83,0.05)",
          }}
        >
          AI-Powered Production Platform
        </div>

        {/* Headline */}
        <h1
          className="text-[clamp(2.5rem,6vw,4.5rem)] font-light leading-[1.1] tracking-tight mb-6"
          style={{ color: "rgba(255,255,255,0.95)" }}
        >
          From Script
          <br />
          <span style={{ color: "#D4A853" }}>to Screen</span>
        </h1>

        {/* Subtitle */}
        <p
          className="text-[clamp(1rem,2vw,1.2rem)] leading-relaxed mb-10 max-w-140"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          Write screenplays, break down scenes, generate storyboards, and produce
          cinematic visuals — all in one AI-native workspace.
        </p>

        {/* CTAs */}
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <Link
              href="/"
              className="landing-btn-primary text-[14px] font-medium px-8 py-3 rounded-full transition-all duration-200"
            >
              Go to Studio
            </Link>
          ) : (
            <Link
              href="/login"
              className="landing-btn-primary text-[14px] font-medium px-8 py-3 rounded-full transition-all duration-200"
            >
              Get Started — Free
            </Link>
          )}
          <a
            href="#gallery"
            onClick={handleExplore}
            className="text-[14px] font-medium px-6 py-3 rounded-full transition-all duration-200"
            style={{
              color: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"
              e.currentTarget.style.color = "rgba(255,255,255,0.8)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"
              e.currentTarget.style.color = "rgba(255,255,255,0.5)"
            }}
          >
            Explore Gallery
          </a>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-pulse">
        <div
          className="w-px h-8"
          style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)" }}
        />
      </div>
    </section>
  )
}
