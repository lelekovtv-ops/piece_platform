import { TOOLKIT_CONFIGS, type ToolkitLevel } from "../_lib/cameraToolkit"

interface CameraTogglesProps {
  shotType: string
  lens: string
  cameraMove: string
  toolkit: ToolkitLevel
  onChange: (patch: { shotSize?: string; lens?: string; cameraMotion?: string }) => void
}

function ToggleRow({
  label,
  options,
  value,
  onChange,
  color,
}: {
  label: string
  options: readonly string[]
  value: string
  onChange: (v: string) => void
  color: string
}) {
  if (options.length === 0) return null
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 w-12 flex-shrink-0 text-[9px] uppercase tracking-widest text-white/25">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="rounded px-1.5 py-0.5 text-[10px] transition"
            style={{
              background: value === opt ? `${color}22` : "transparent",
              color: value === opt ? color : "rgba(255,255,255,0.3)",
              border: `1px solid ${value === opt ? `${color}33` : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export function CameraToggles({ shotType, lens, cameraMove, toolkit, onChange }: CameraTogglesProps) {
  const config = TOOLKIT_CONFIGS[toolkit]

  return (
    <div className="flex flex-col gap-2">
      <ToggleRow
        label="Size"
        options={config.shotSizes}
        value={shotType}
        onChange={(v) => onChange({ shotSize: v })}
        color="#4A7C6F"
      />
      <ToggleRow
        label="Move"
        options={config.cameraMoves}
        value={cameraMove}
        onChange={(v) => onChange({ cameraMotion: v })}
        color="#4A7C6F"
      />
      {config.showLens && (
        <ToggleRow
          label="Lens"
          options={config.lenses}
          value={lens}
          onChange={(v) => onChange({ lens: v })}
          color="#7C6A4A"
        />
      )}
    </div>
  )
}
