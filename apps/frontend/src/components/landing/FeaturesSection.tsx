"use client"

import { PenLine, Clapperboard, ImageIcon, Layout, Download } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useFadeIn } from "@/hooks/useFadeIn"

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: PenLine,
    title: "Scriptwriter",
    description:
      "AI-assisted screenplay editor with real-time formatting, character tracking, and intelligent scene suggestions.",
  },
  {
    icon: Clapperboard,
    title: "Breakdown Studio",
    description:
      "Visual scene breakdown with cinematography planning — shot types, camera angles, lighting, and mood boards.",
  },
  {
    icon: ImageIcon,
    title: "Media Library",
    description:
      "Centralized asset management with AI generation. Create, organize, and reference images and videos instantly.",
  },
  {
    icon: Layout,
    title: "Desktop",
    description:
      "Infinite whiteboard for creative exploration. Arrange stickies, images, text blocks, and A4 sheets freely.",
  },
  {
    icon: Download,
    title: "Export",
    description:
      "Production-ready output — screenplays, storyboards, shot lists, and visual packages for your team.",
  },
]

export function FeaturesSection() {
  const ref = useFadeIn()

  return (
    <section id="features" ref={ref} className="landing-fade-in relative py-24 md:py-32 px-6 md:px-12">
      {/* Section header */}
      <div className="max-w-275 mx-auto mb-16 text-center">
        <p
          className="text-[12px] font-medium tracking-widest uppercase mb-3"
          style={{ color: "rgba(212,168,83,0.6)" }}
        >
          Tools
        </p>
        <h2
          className="text-[clamp(1.8rem,4vw,2.8rem)] font-light tracking-tight mb-4"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          Everything you need to produce
        </h2>
        <p
          className="text-[15px] max-w-125 mx-auto leading-relaxed"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Five integrated modules that cover the entire pre-production pipeline.
        </p>
      </div>

      {/* Feature cards grid */}
      <div className="max-w-275 mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((feature) => (
          <FeatureCard key={feature.title} feature={feature} />
        ))}
      </div>
    </section>
  )
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon

  return (
    <div
      className="group relative p-6 rounded-2xl transition-all duration-300 cursor-default"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.04)"
        e.currentTarget.style.borderColor = "rgba(212,168,83,0.15)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.02)"
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"
      }}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors duration-300"
        style={{
          background: "rgba(212,168,83,0.08)",
          border: "1px solid rgba(212,168,83,0.12)",
        }}
      >
        <Icon
          size={18}
          strokeWidth={1.5}
          style={{ color: "rgba(212,168,83,0.7)" }}
        />
      </div>

      {/* Title */}
      <h3
        className="text-[15px] font-medium mb-2 tracking-wide"
        style={{ color: "rgba(255,255,255,0.85)" }}
      >
        {feature.title}
      </h3>

      {/* Description */}
      <p
        className="text-[13px] leading-relaxed"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        {feature.description}
      </p>
    </div>
  )
}
