"use client"

import { useCallback, useRef, useState } from "react"
import { Camera, Film, Sparkles, Wand2 } from "lucide-react"
import type { ShotCard as ShotCardType } from "@/lib/directorTypes"

interface ShotCardProps {
  card: ShotCardType
  isActive: boolean
  onSelect: (shotId: string) => void
  onUpdateDirection: (shotId: string, text: string) => void
  onUpdateCard: (shotId: string, patch: Partial<ShotCardType>) => void
}

export function ShotCard({ card, isActive, onSelect, onUpdateDirection, onUpdateCard }: ShotCardProps) {
  const [expanded, setExpanded] = useState(false)
  const directionRef = useRef<HTMLDivElement>(null)

  const handleDirectionBlur = useCallback(() => {
    const text = directionRef.current?.textContent ?? ""
    if (text !== card.direction) {
      onUpdateDirection(card.id, text)
    }
  }, [card.id, card.direction, onUpdateDirection])

  const hasThumbnail = !!card.thumbnailUrl

  return (
    <div
      onClick={() => onSelect(card.id)}
      className={[
        "group relative flex flex-col rounded-lg border transition-all duration-200 cursor-pointer",
        isActive
          ? "border-[#D4A853]/40 bg-[#1E1C19] ring-1 ring-[#D4A853]/20"
          : "border-white/8 bg-[#161412] hover:border-white/15",
      ].join(" ")}
    >
      {/* Header: shot number + meta */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white/70">
            {card.shotNumber}
          </span>
          {card.shotType && (
            <span className="text-[9px] uppercase tracking-wider text-white/30">
              {card.shotType}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-white/25">
          {card.lens && <span>{card.lens}</span>}
          {card.cameraMove && card.cameraMove !== "STATIC" && (
            <>
              <span>·</span>
              <span>{card.cameraMove}</span>
            </>
          )}
          <span>·</span>
          <span className="tabular-nums">{card.duration.toFixed(1)}s</span>
        </div>
      </div>

      {/* 16:9 frame preview */}
      <div className="relative mx-2 aspect-video overflow-hidden rounded-md bg-black/30">
        {hasThumbnail ? (
          <img
            src={card.thumbnailUrl!}
            alt={card.shotNumber}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/15">
            <Film size={20} />
            <span className="text-[8px] uppercase tracking-wider">No image yet</span>
          </div>
        )}
      </div>

      {/* Direction field (editable) */}
      <div
        ref={directionRef}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleDirectionBlur}
        onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
        className="mx-3 my-2 min-h-[1.6em] text-[11px] leading-relaxed text-white/50 outline-none focus:text-white/80"
        data-placeholder="Director notes..."
      >
        {card.direction || ""}
      </div>

      {/* Dialogue/VO attached */}
      {(card.dialogue.length > 0 || card.vo) && (
        <div className="mx-3 mb-2 space-y-0.5 border-t border-white/5 pt-1.5">
          {card.dialogue.map((d, i) => (
            <div key={i} className="text-[9px]">
              <span className="font-semibold text-[#378ADD]/60">{d.characterName}:</span>{" "}
              <span className="text-white/35">{d.text}</span>
            </div>
          ))}
          {card.vo && (
            <div className="text-[9px] italic text-[#7F77DD]/50">
              VO: {card.vo}
            </div>
          )}
        </div>
      )}

      {/* Character/location tags */}
      {(card.characters.length > 0 || card.locations.length > 0) && (
        <div className="mx-3 mb-2 flex flex-wrap gap-1">
          {card.characters.map((c) => (
            <span key={c} className="rounded-full bg-emerald-500/10 px-1.5 py-0 text-[7px] font-medium text-emerald-400/60">
              {c}
            </span>
          ))}
          {card.locations.map((l) => (
            <span key={l} className="rounded-full bg-amber-500/10 px-1.5 py-0 text-[7px] font-medium text-amber-400/60">
              {l}
            </span>
          ))}
        </div>
      )}

      {/* Expandable: prompt + actions */}
      {expanded && (
        <div className="mx-3 mb-2 space-y-2 border-t border-white/5 pt-2">
          <div className="text-[9px] text-white/20">
            <span className="font-semibold uppercase tracking-wider">Prompt</span>
            <p className="mt-0.5 text-white/35">{card.prompt || "—"}</p>
          </div>
          <div className="flex gap-1.5">
            <button type="button" className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[9px] text-white/40 transition-colors hover:border-[#D4A853]/30 hover:text-[#D4A853]">
              <Sparkles size={10} /> ENHANCE
            </button>
            <button type="button" className="flex items-center gap-1 rounded-md border border-[#D4537E]/30 bg-[#D4537E]/8 px-2 py-1 text-[9px] text-[#D4537E] transition-colors hover:bg-[#D4537E]/15">
              <Wand2 size={10} /> BUILD
            </button>
          </div>
        </div>
      )}

      {/* Expand toggle */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
        className="border-t border-white/5 py-1 text-[8px] text-white/15 transition-colors hover:text-white/30"
      >
        {expanded ? "▲" : "▼"}
      </button>
    </div>
  )
}
