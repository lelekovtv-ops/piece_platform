// ── Generation Layer Types ──────────────────────────────────────

export type GenerationCategory = "image" | "video" | "lipsync" | "motion"

export type ProviderName = "openai" | "google" | "sjinn"

export interface GenerationModel {
  id: string
  label: string
  provider: ProviderName
  category: GenerationCategory
  /** Short tag for UI badges (O / G / S) */
  tag: string
  /** SJinn tool_type identifier */
  sjinnTool?: string
  capabilities: string[]
  /** Approximate credit cost per generation (SJinn) */
  creditCost?: number
}

export interface GenerationRequest {
  model: string
  prompt: string
  referenceImages?: string[]
  stylePrompt?: string
  /** For image-to-video: source image URL */
  sourceImageUrl?: string
  /** For lipsync: audio URL or data-url */
  audioUrl?: string
  /** Aspect ratio override */
  aspectRatio?: string
  /** For motion control: reference motion video URL */
  motionVideoUrl?: string
}

export interface GenerationResult {
  type: "blob" | "url"
  blob?: Blob
  url?: string
  contentType: string
}

export interface GenerationProgress {
  status: "queued" | "processing" | "done" | "failed"
  taskId?: string
  error?: string
}
