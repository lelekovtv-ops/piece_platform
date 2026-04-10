"use client"

import Picker from "react-mobile-picker"

// ── Options ──

const SHOT_SIZES = [
  { value: "", label: "—" },
  { value: "ECU", label: "ECU · eyes" },
  { value: "CU", label: "CU · face" },
  { value: "MCU", label: "MCU · chest" },
  { value: "MS", label: "MS · waist" },
  { value: "MLS", label: "MLS · knees" },
  { value: "LS", label: "LS · full" },
  { value: "EWS", label: "EWS · wide" },
  { value: "AERIAL", label: "Aerial" },
  { value: "OTS", label: "OTS" },
  { value: "POV", label: "POV" },
  { value: "INSERT", label: "Insert" },
]

const MOVEMENTS = [
  { value: "", label: "—" },
  { value: "static", label: "Static" },
  { value: "push-in", label: "Push In" },
  { value: "pull-out", label: "Pull Out" },
  { value: "pan", label: "Pan" },
  { value: "crane-up", label: "Crane Up" },
  { value: "crane-down", label: "Crane Down" },
  { value: "orbit", label: "Orbit" },
  { value: "drone", label: "Drone" },
  { value: "handheld", label: "Handheld" },
  { value: "zoom-in", label: "Zoom In" },
  { value: "slow-mo", label: "Slow Mo" },
]

const LENSES = [
  { value: "", label: "—" },
  { value: "16", label: "16mm ultra" },
  { value: "24", label: "24mm wide" },
  { value: "35", label: "35mm natural" },
  { value: "50", label: "50mm normal" },
  { value: "85", label: "85mm portrait" },
  { value: "135", label: "135mm tele" },
  { value: "anamorphic", label: "Anamorphic" },
  { value: "macro", label: "Macro" },
  { value: "tilt-shift", label: "Tilt-Shift" },
]

// ── State ──

export interface CameraState {
  shotSize: string
  movement: string
  lens: string
}

export const DEFAULT_CAMERA: CameraState = {
  shotSize: "",
  movement: "",
  lens: "",
}

export function cameraToPromptParts(cam: CameraState): string[] {
  const parts: string[] = []
  const sizeLabels: Record<string, string> = {
    ECU: "extreme close-up", CU: "close-up", MCU: "medium close-up",
    MS: "medium shot", MLS: "medium long shot", LS: "long shot",
    EWS: "extreme wide shot", AERIAL: "aerial", OTS: "over the shoulder",
    POV: "POV", INSERT: "insert",
  }
  if (cam.shotSize) parts.push(sizeLabels[cam.shotSize] || cam.shotSize)

  if (cam.movement && cam.movement !== "static") {
    const m = cam.movement.replace("-", " ")
    if (cam.movement === "slow-mo") {
      parts.push("slow motion 120fps")
    } else {
      parts.push(`${m} movement`)
    }
  } else if (cam.movement === "static") {
    parts.push("static camera")
  }

  if (cam.lens) {
    if (["anamorphic", "macro", "tilt-shift"].includes(cam.lens)) {
      parts.push(`${cam.lens} lens`)
    } else {
      parts.push(`${cam.lens}mm lens`)
    }
  }
  return parts
}

// ── Component ──

interface CameraPanelProps {
  camera: CameraState
  onChange: (camera: CameraState) => void
}

export function CameraPanel({ camera, onChange }: CameraPanelProps) {
  const pickerValue = {
    shotSize: camera.shotSize || "",
    movement: camera.movement || "",
    lens: camera.lens || "",
  }

  const handleChange = (newValue: Record<string, string>) => {
    onChange({
      shotSize: newValue.shotSize || "",
      movement: newValue.movement || "",
      lens: newValue.lens || "",
    })
  }

  return (
    <div className="px-3.5 py-2 bg-[#161616]">
      {/* Column headers */}
      <div className="flex mb-0.5">
        <div className="flex-1 text-center text-[9px] uppercase tracking-widest text-white/25 font-mono">shot size</div>
        <div className="flex-1 text-center text-[9px] uppercase tracking-widest text-white/25 font-mono">movement</div>
        <div className="flex-1 text-center text-[9px] uppercase tracking-widest text-white/25 font-mono">lens</div>
      </div>

      {/* Picker */}
      <div
        className="[&_.rmp-container]:bg-transparent [&_.rmp-column]:cursor-grab [&_.rmp-column]:active:cursor-grabbing"
        style={{
          // Override picker styles
          ["--rmp-overlay-bg" as string]: "linear-gradient(#161616ee, #16161600, #16161600, #161616ee)",
          ["--rmp-highlight-bg" as string]: "rgba(255,255,255,0.04)",
        }}
      >
        <Picker
          value={pickerValue}
          onChange={handleChange}
          wheelMode="natural"
          height={120}
          itemHeight={32}
        >
          <Picker.Column name="shotSize">
            {SHOT_SIZES.map((opt) => (
              <Picker.Item key={opt.value} value={opt.value}>
                {({ selected }) => (
                  <div className={`text-center text-[12px] font-mono transition-colors ${
                    selected ? "text-[#D4A853] font-medium" : "text-white/25"
                  }`}>
                    {opt.label}
                  </div>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>

          <Picker.Column name="movement">
            {MOVEMENTS.map((opt) => (
              <Picker.Item key={opt.value} value={opt.value}>
                {({ selected }) => (
                  <div className={`text-center text-[12px] font-mono transition-colors ${
                    selected ? "text-[#85B7EB] font-medium" : "text-white/25"
                  }`}>
                    {opt.label}
                  </div>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>

          <Picker.Column name="lens">
            {LENSES.map((opt) => (
              <Picker.Item key={opt.value} value={opt.value}>
                {({ selected }) => (
                  <div className={`text-center text-[12px] font-mono transition-colors ${
                    selected ? "text-[#4A7C6F] font-medium" : "text-white/25"
                  }`}>
                    {opt.label}
                  </div>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>
        </Picker>
      </div>

      {/* Summary line */}
      {(camera.shotSize || camera.movement || camera.lens) && (
        <div className="mt-1 text-center text-[10px] font-mono text-white/20">
          {cameraToPromptParts(camera).join(" · ")}
        </div>
      )}
    </div>
  )
}
