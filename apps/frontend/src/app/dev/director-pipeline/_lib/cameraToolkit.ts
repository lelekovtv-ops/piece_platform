import { SHOT_SIZE_OPTIONS, CAMERA_MOTION_OPTIONS } from "@/components/editor/screenplay/storyboardUtils"

export type ToolkitLevel = "simple" | "standard" | "pro"

const LENSES = ["16mm", "24mm", "35mm", "50mm", "85mm", "135mm"] as const

export const TOOLKIT_CONFIGS: Record<ToolkitLevel, {
  shotSizes: readonly string[]
  cameraMoves: readonly string[]
  lenses: readonly string[]
  showLens: boolean
}> = {
  simple: {
    shotSizes: ["WIDE", "MEDIUM", "CLOSE"],
    cameraMoves: [],
    lenses: [],
    showLens: false,
  },
  standard: {
    shotSizes: SHOT_SIZE_OPTIONS,
    cameraMoves: CAMERA_MOTION_OPTIONS,
    lenses: [],
    showLens: false,
  },
  pro: {
    shotSizes: SHOT_SIZE_OPTIONS,
    cameraMoves: CAMERA_MOTION_OPTIONS,
    lenses: LENSES,
    showLens: true,
  },
}
