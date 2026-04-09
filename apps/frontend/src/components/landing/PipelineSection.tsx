"use client"

import { PenLine, Scan, Palette, Package } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useFadeIn } from "@/hooks/useFadeIn"

interface PipelineStep {
  number: string
  icon: LucideIcon
  title: string
  description: string
}

const STEPS: PipelineStep[] = [
  {
    number: "01",
    icon: PenLine,
    title: "Write",
    description: "Start with your screenplay. AI assists with formatting, dialogue, and scene structure.",
  },
  {
    number: "02",
    icon: Scan,
    title: "Break Down",
    description: "AI analyzes every scene — characters, locations, props, mood, and technical requirements.",
  },
  {
    number: "03",
    icon: Palette,
    title: "Visualize",
    description: "Generate storyboards, shot compositions, and visual references with AI image models.",
  },
  {
    number: "04",
    icon: Package,
    title: "Produce",
    description: "Export production-ready packages — shot lists, storyboards, and visual breakdowns.",
  },
]

export function PipelineSection() {
  const ref = useFadeIn()

  return (
    <section id="pipeline" ref={ref} className="landing-fade-in relative py-24 md:py-32 px-6 md:px-12">
      {/* Section header */}
      <div className="max-w-275 mx-auto mb-16 text-center">
        <p
          className="text-[12px] font-medium tracking-widest uppercase mb-3"
          style={{ color: "rgba(212,168,83,0.6)" }}
        >
          Workflow
        </p>
        <h2
          className="text-[clamp(1.8rem,4vw,2.8rem)] font-light tracking-tight mb-4"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          How It Works
        </h2>
        <p
          className="text-[15px] max-w-125 mx-auto leading-relaxed"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          A streamlined pipeline from initial idea to production-ready assets.
        </p>
      </div>

      {/* Steps */}
      <div className="max-w-275 mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
        {/* Connector line (desktop only) */}
        <div
          className="hidden lg:block absolute top-13 left-[12%] right-[12%] h-px"
          style={{
            background: "linear-gradient(to right, transparent, rgba(212,168,83,0.15) 15%, rgba(212,168,83,0.15) 85%, transparent)",
          }}
        />

        {STEPS.map((step) => (
          <StepCard key={step.number} step={step} />
        ))}
      </div>
    </section>
  )
}

function StepCard({ step }: { step: PipelineStep }) {
  const Icon = step.icon

  return (
    <div className="relative flex flex-col items-center text-center p-6">
      {/* Number + Icon circle */}
      <div className="relative mb-5">
        <div
          className="w-18 h-18 rounded-2xl flex items-center justify-center relative z-10"
          style={{
            background: "rgba(212,168,83,0.06)",
            border: "1px solid rgba(212,168,83,0.12)",
          }}
        >
          <Icon size={24} strokeWidth={1.5} style={{ color: "rgba(212,168,83,0.6)" }} />
        </div>

        {/* Step number */}
        <span
          className="absolute -top-2 -right-2 text-[11px] font-semibold tracking-wider w-6 h-6 rounded-full flex items-center justify-center z-20"
          style={{
            background: "#D4A853",
            color: "#0B0C10",
          }}
        >
          {step.number}
        </span>
      </div>

      {/* Title */}
      <h3
        className="text-[15px] font-medium mb-2 tracking-wide"
        style={{ color: "rgba(255,255,255,0.85)" }}
      >
        {step.title}
      </h3>

      {/* Description */}
      <p
        className="text-[13px] leading-relaxed max-w-55"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        {step.description}
      </p>
    </div>
  )
}
