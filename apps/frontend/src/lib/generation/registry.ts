import type { GenerationCategory, GenerationModel } from "./types"

// ── Model Registry ─────────────────────────────────────────────

export const GENERATION_MODELS: GenerationModel[] = [
  // ── Existing image providers (OpenAI / Google) ───────────────
  { id: "nano-banana",     label: "Banana",       provider: "google",  category: "image", tag: "G", capabilities: ["text-to-image"] },
  { id: "nano-banana-2",   label: "Banana 2",     provider: "google",  category: "image", tag: "G", capabilities: ["text-to-image"] },
  { id: "nano-banana-pro", label: "Banana Pro",   provider: "google",  category: "image", tag: "G", capabilities: ["text-to-image"] },
  { id: "gpt-image",       label: "GPT Image",    provider: "openai",  category: "image", tag: "O", capabilities: ["text-to-image", "image-to-image"] },

  // ── SJinn image ──────────────────────────────────────────────
  { id: "sjinn-nano-banana",     label: "SJ Banana",       provider: "sjinn", category: "image", tag: "S", sjinnTool: "nano-banana-image-api",     capabilities: ["text-to-image"], creditCost: 50 },
  { id: "sjinn-nano-banana-pro", label: "SJ Banana Pro",   provider: "sjinn", category: "image", tag: "S", sjinnTool: "nano-banana-image-pro-api", capabilities: ["text-to-image"], creditCost: 150 },
  { id: "sjinn-nano-banana-2",   label: "SJ Banana 2",     provider: "sjinn", category: "image", tag: "S", sjinnTool: "nano-banana-image-2-api",   capabilities: ["text-to-image"], creditCost: 75 },
  { id: "sjinn-seedream",        label: "Seedream v4.5",   provider: "sjinn", category: "image", tag: "S", sjinnTool: "seedream-v4-5-api",         capabilities: ["text-to-image"], creditCost: 50 },
  { id: "sjinn-seedream-lite",   label: "Seedream Lite",   provider: "sjinn", category: "image", tag: "S", sjinnTool: "seedream-v5-lite-api",      capabilities: ["text-to-image"], creditCost: 50 },

  // ── SJinn video (text-to-video) ──────────────────────────────
  { id: "sjinn-veo3",       label: "Veo 3",       provider: "sjinn", category: "video", tag: "S", sjinnTool: "veo3-text-to-video-fast-api",  capabilities: ["text-to-video"],  creditCost: 420 },
  { id: "sjinn-veo3-i2v",   label: "Veo 3 i2v",   provider: "sjinn", category: "video", tag: "S", sjinnTool: "veo3-image-to-video-fast-api", capabilities: ["image-to-video"], creditCost: 420 },
  { id: "sjinn-sora2",      label: "Sora 2",      provider: "sjinn", category: "video", tag: "S", sjinnTool: "sora2-text-to-video-api",      capabilities: ["text-to-video"],  creditCost: 420 },
  { id: "sjinn-sora2-i2v",  label: "Sora 2 i2v",  provider: "sjinn", category: "video", tag: "S", sjinnTool: "sora2-image-to-video-api",     capabilities: ["image-to-video"], creditCost: 420 },
  { id: "sjinn-grok-video", label: "Grok Video",  provider: "sjinn", category: "video", tag: "S", sjinnTool: "grok-text-to-video-api",       capabilities: ["text-to-video"],  creditCost: 500 },
  { id: "sjinn-grok-i2v",   label: "Grok i2v",    provider: "sjinn", category: "video", tag: "S", sjinnTool: "grok-image-to-video-api",      capabilities: ["image-to-video"], creditCost: 500 },
  { id: "sjinn-kling3",     label: "Kling 3",     provider: "sjinn", category: "video", tag: "S", sjinnTool: "kling3-text-to-video-api",     capabilities: ["text-to-video"],  creditCost: 1000 },
  { id: "sjinn-kling3-i2v", label: "Kling 3 i2v", provider: "sjinn", category: "video", tag: "S", sjinnTool: "kling3-image-to-video-api",    capabilities: ["image-to-video"], creditCost: 1000 },

  // ── SJinn lipsync ────────────────────────────────────────────
  { id: "sjinn-lipsync", label: "Lipsync", provider: "sjinn", category: "lipsync", tag: "S", sjinnTool: "image-lipsync-api", capabilities: ["lipsync"], creditCost: 30 },

  // ── SJinn motion control ─────────────────────────────────────
  { id: "sjinn-kling26-motion", label: "Kling 2.6 Motion", provider: "sjinn", category: "motion", tag: "S", sjinnTool: "kling26-motion-control-api",  capabilities: ["motion-control"], creditCost: 425 },
  { id: "sjinn-kling3-motion",  label: "Kling 3 Motion",  provider: "sjinn", category: "motion", tag: "S", sjinnTool: "kling-v3-motion-control-api", capabilities: ["motion-control"], creditCost: 650 },
]

// ── Accessors ──────────────────────────────────────────────────

export const getGenerationModelsByCategory = (cat: GenerationCategory) =>
  GENERATION_MODELS.filter((m) => m.category === cat)

export const getGenerationModelById = (id: string) =>
  GENERATION_MODELS.find((m) => m.id === id)

/** Image models for ShotStudio / StoryboardPanel selectors */
export const IMAGE_GEN_MODELS = GENERATION_MODELS.filter((m) => m.category === "image")

/** Video models for video generation UI */
export const VIDEO_GEN_MODELS = GENERATION_MODELS.filter((m) => m.category === "video")
