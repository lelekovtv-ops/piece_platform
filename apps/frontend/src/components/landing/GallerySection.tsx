"use client"

import { useFadeIn } from "@/hooks/useFadeIn"

interface GalleryItem {
  id: string
  title: string
  author: string
  aspect: "portrait" | "landscape" | "square"
  gradient: string
}

const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: "1",
    title: "Neon Noir",
    author: "Studio Lumière",
    aspect: "portrait",
    gradient: "linear-gradient(135deg, #1a0a2e 0%, #16213e 50%, #0f3460 100%)",
  },
  {
    id: "2",
    title: "Desert Mirage",
    author: "Oasis Films",
    aspect: "landscape",
    gradient: "linear-gradient(135deg, #2d1b00 0%, #44290a 50%, #6b3a12 100%)",
  },
  {
    id: "3",
    title: "Ghost Protocol",
    author: "Cipher Motion",
    aspect: "square",
    gradient: "linear-gradient(135deg, #0d1117 0%, #161b22 50%, #21262d 100%)",
  },
  {
    id: "4",
    title: "Sakura Dreams",
    author: "Hanami Pictures",
    aspect: "portrait",
    gradient: "linear-gradient(135deg, #2d0a1e 0%, #3d1232 50%, #5c1a4a 100%)",
  },
  {
    id: "5",
    title: "Iron Horizon",
    author: "Forge Studios",
    aspect: "landscape",
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a3e 100%)",
  },
  {
    id: "6",
    title: "Golden Hour",
    author: "Sol Cinematics",
    aspect: "square",
    gradient: "linear-gradient(135deg, #2a1f0a 0%, #3d2e12 50%, #504018 100%)",
  },
  {
    id: "7",
    title: "Subzero",
    author: "Frost Frame",
    aspect: "landscape",
    gradient: "linear-gradient(135deg, #0a1628 0%, #0e2240 50%, #123358 100%)",
  },
  {
    id: "8",
    title: "Velvet Underground",
    author: "Deep Cut Films",
    aspect: "portrait",
    gradient: "linear-gradient(135deg, #1a0510 0%, #2d0a1a 50%, #400f28 100%)",
  },
  {
    id: "9",
    title: "Atlas Shrugged",
    author: "Meridian Post",
    aspect: "square",
    gradient: "linear-gradient(135deg, #0f1a0a 0%, #1a2d12 50%, #254018 100%)",
  },
]

const ASPECT_CLASSES: Record<GalleryItem["aspect"], string> = {
  portrait: "row-span-2",
  landscape: "col-span-1",
  square: "col-span-1",
}

const ASPECT_HEIGHTS: Record<GalleryItem["aspect"], string> = {
  portrait: "320px",
  landscape: "200px",
  square: "240px",
}

export function GallerySection() {
  const ref = useFadeIn()

  return (
    <section id="gallery" ref={ref} className="landing-fade-in relative py-24 md:py-32 px-6 md:px-12">
      {/* Section header */}
      <div className="max-w-275 mx-auto mb-16 text-center">
        <p
          className="text-[12px] font-medium tracking-widest uppercase mb-3"
          style={{ color: "rgba(212,168,83,0.6)" }}
        >
          Gallery
        </p>
        <h2
          className="text-[clamp(1.8rem,4vw,2.8rem)] font-light tracking-tight mb-4"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          Community Showcase
        </h2>
        <p
          className="text-[15px] max-w-125 mx-auto leading-relaxed"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Explore projects created by filmmakers and storytellers on PIECE.
        </p>
      </div>

      {/* Masonry grid */}
      <div className="max-w-275 mx-auto columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
        {GALLERY_ITEMS.map((item) => (
          <GalleryCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

function GalleryCard({ item }: { item: GalleryItem }) {
  return (
    <div
      className={`group relative rounded-2xl overflow-hidden break-inside-avoid cursor-pointer transition-all duration-300 ${ASPECT_CLASSES[item.aspect]}`}
      style={{
        height: ASPECT_HEIGHTS[item.aspect],
        border: "1px solid rgba(255,255,255,0.05)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(212,168,83,0.2)"
        e.currentTarget.style.transform = "translateY(-2px)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"
        e.currentTarget.style.transform = "translateY(0)"
      }}
    >
      {/* Placeholder gradient background */}
      <div
        className="absolute inset-0"
        style={{ background: item.gradient }}
      />

      {/* Film grain overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Hover overlay */}
      <div
        className="absolute inset-0 flex flex-col justify-end p-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)",
        }}
      >
        <h3
          className="text-[14px] font-medium mb-0.5"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          {item.title}
        </h3>
        <p
          className="text-[12px]"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          {item.author}
        </p>
      </div>
    </div>
  )
}
