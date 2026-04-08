"use client"

import type { DirectorShotGroup } from "@/lib/directorTypes"
import type { ShotCard as ShotCardType } from "@/lib/directorTypes"
import { ShotCard } from "./ShotCard"

interface ShotGroupProps {
  group: DirectorShotGroup
  isActive: boolean
  activeShotId: string | null
  onSelectShot: (shotId: string) => void
  onUpdateDirection: (shotId: string, text: string) => void
  onUpdateCard: (shotId: string, patch: Partial<ShotCardType>) => void
}

export function ShotGroup({
  group,
  isActive,
  activeShotId,
  onSelectShot,
  onUpdateDirection,
  onUpdateCard,
}: ShotGroupProps) {
  return (
    <div
      data-group-id={group.actionBlockId}
      className={[
        "rounded-xl border transition-all duration-300",
        isActive
          ? "border-[#D4A853]/20 bg-[#1A1816]"
          : "border-white/5 bg-[#141210] opacity-100",
      ].join(" ")}
    >
      {/* Group header: source text from action block (readonly) */}
      <div className="px-4 py-2.5 border-b border-white/5">
        <p className="text-[10px] leading-snug text-white/30 font-mono">
          ▸ {group.sourceText.length > 120 ? group.sourceText.slice(0, 120) + "…" : group.sourceText}
          <span className="ml-2 text-white/15">
            {group.shots.length} shot{group.shots.length !== 1 ? "s" : ""}
          </span>
        </p>
      </div>

      {/* Shot cards grid */}
      <div className="grid grid-cols-2 gap-3 p-3">
        {group.shots.map((card) => (
          <ShotCard
            key={card.id}
            card={card}
            isActive={activeShotId === card.id}
            onSelect={onSelectShot}
            onUpdateDirection={onUpdateDirection}
            onUpdateCard={onUpdateCard}
          />
        ))}
      </div>
    </div>
  )
}
