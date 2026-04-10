import { useBibleStore } from "@/store/bible"
import { Mic, MapPin, User } from "lucide-react"

export function BibleSidebar({ collapsed }: { collapsed: boolean }) {
  const characters = useBibleStore((s) => s.characters)
  const locations = useBibleStore((s) => s.locations)

  if (collapsed) return null

  return (
    <div className="flex w-60 flex-shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/8 pr-3">
      {/* Characters */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <User className="h-3 w-3 text-[#D4A853]/60" />
          <span className="text-[10px] uppercase tracking-widest text-white/30">
            Characters ({characters.length})
          </span>
        </div>
        {characters.map((c) => (
          <div
            key={c.id}
            className="mb-2 rounded-lg border border-white/6 bg-white/3 p-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#D4A853]/80">{c.name}</span>
              {c.voice?.voiceId && (
                <Mic className="h-3 w-3 text-emerald-400/50" />
              )}
            </div>
            {c.referenceImages.length > 0 && (
              <div className="mt-1.5 flex gap-1">
                {c.referenceImages.slice(0, 4).map((img) => (
                  <div
                    key={img.id}
                    className="h-10 w-10 overflow-hidden rounded border border-white/10"
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
            {!c.referenceImages.length && c.generatedPortraitUrl && (
              <div className="mt-1.5 h-10 w-10 overflow-hidden rounded border border-white/10">
                <img
                  src={c.generatedPortraitUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            {c.appearancePrompt && (
              <p className="mt-1 text-[10px] leading-tight text-white/25 line-clamp-2">
                {c.appearancePrompt}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Locations */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-emerald-400/60" />
          <span className="text-[10px] uppercase tracking-widest text-white/30">
            Locations ({locations.length})
          </span>
        </div>
        {locations.map((l) => (
          <div
            key={l.id}
            className="mb-2 rounded-lg border border-white/6 bg-white/3 p-2"
          >
            <span className="text-xs font-medium text-emerald-400/70">{l.name}</span>
            {(l.referenceImages?.[0]?.url || l.generatedImageUrl) && (
              <div className="mt-1.5 h-16 w-full overflow-hidden rounded border border-white/10">
                <img
                  src={l.referenceImages?.[0]?.url || l.generatedImageUrl || ""}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            {l.description && (
              <p className="mt-1 text-[10px] leading-tight text-white/25 line-clamp-2">
                {l.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
