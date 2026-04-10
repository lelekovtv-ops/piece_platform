"use client"

import { LandingNav } from "@/components/landing/LandingNav"
import { HeroSection } from "@/components/landing/HeroSection"
import { FeaturesSection } from "@/components/landing/FeaturesSection"
import { GallerySection } from "@/components/landing/GallerySection"
import { PipelineSection } from "@/components/landing/PipelineSection"
import { LandingFooter } from "@/components/landing/LandingFooter"

export default function HomePage() {
  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "#0B0C10", color: "#ffffff" }}
    >
      <LandingNav />
      <HeroSection />
      <FeaturesSection />
      <GallerySection />
      <PipelineSection />
      <LandingFooter />
    </div>
  )
}
