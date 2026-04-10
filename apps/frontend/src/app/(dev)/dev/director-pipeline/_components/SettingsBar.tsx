import { IMAGE_GEN_MODELS } from "@/components/editor/screenplay/storyboardUtils"
import type { ToolkitLevel } from "../_lib/cameraToolkit"
import type { GenerationMode } from "../_lib/promptAssembler"

interface SettingsBarProps {
  toolkit: ToolkitLevel
  onToolkitChange: (t: ToolkitLevel) => void
  genMode: GenerationMode
  onGenModeChange: (m: GenerationMode) => void
  model: string
  onModelChange: (m: string) => void
}

const TOOLKITS: ToolkitLevel[] = ["simple", "standard", "pro"]
const GEN_MODES: GenerationMode[] = ["omni", "simple"]

function PillGroup<T extends string>({
  options,
  value,
  onChange,
  color = "#D4A853",
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  color?: string
}) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className="rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider transition"
          style={{
            background: value === opt ? `${color}22` : "transparent",
            color: value === opt ? color : "rgba(255,255,255,0.4)",
            border: `1px solid ${value === opt ? `${color}44` : "rgba(255,255,255,0.08)"}`,
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

export function SettingsBar({
  toolkit, onToolkitChange,
  genMode, onGenModeChange,
  model, onModelChange,
}: SettingsBarProps) {
  return (
    <div className="flex items-center gap-6 border-b border-white/8 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-white/30">Camera</span>
        <PillGroup options={TOOLKITS} value={toolkit} onChange={onToolkitChange} />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-white/30">Mode</span>
        <PillGroup options={GEN_MODES} value={genMode} onChange={onGenModeChange} color="#4A7C6F" />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-white/30">Model</span>
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 outline-none"
        >
          {IMAGE_GEN_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} ({m.price})
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
