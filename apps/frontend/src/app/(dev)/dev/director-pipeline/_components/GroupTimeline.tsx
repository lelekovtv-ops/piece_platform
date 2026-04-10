import type { ShotCard } from "@/lib/directorTypes"

interface GroupTimelineProps {
  shots: ShotCard[]
}

export function GroupTimeline({ shots }: GroupTimelineProps) {
  const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0)
  if (totalDuration === 0) return null

  return (
    <div className="flex h-5 w-full gap-px overflow-hidden rounded">
      {shots.map((shot) => {
        const pct = (shot.duration / totalDuration) * 100
        const hasThumb = !!shot.thumbnailUrl
        return (
          <div
            key={shot.id}
            className="relative flex items-center justify-center overflow-hidden"
            style={{
              width: `${pct}%`,
              minWidth: 12,
              background: hasThumb ? "#4A7C6F33" : "rgba(255,255,255,0.04)",
              borderBottom: `2px solid ${hasThumb ? "#4A7C6F" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            <span className="text-[8px] font-medium text-white/25">{shot.shotNumber}</span>
          </div>
        )
      })}
    </div>
  )
}
