import { getGenerationModelById } from "./registry"
import type { GenerationProgress, GenerationRequest, GenerationResult } from "./types"

// ── Unified Generation Client ──────────────────────────────────

/**
 * Single entry-point for all generation: image, video, lipsync, motion.
 * Routes to the correct API based on provider.
 */
export async function generateContent(
  request: GenerationRequest,
  onProgress?: (progress: GenerationProgress) => void,
): Promise<GenerationResult> {
  const model = getGenerationModelById(request.model)
  if (!model) throw new Error(`Unknown model: ${request.model}`)

  switch (model.provider) {
    case "openai":
      return generateViaOpenAI(request)
    case "google":
      return generateViaGoogle(request)
    case "sjinn":
      return generateViaSJinn(request, model.sjinnTool!, onProgress)
    default:
      throw new Error(`Unknown provider: ${model.provider}`)
  }
}

// ── OpenAI (existing /api/gpt-image route) ─────────────────────

async function generateViaOpenAI(req: GenerationRequest): Promise<GenerationResult> {
  const res = await fetch("/api/gpt-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: req.prompt,
      referenceImages: req.referenceImages,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    let msg = `Generation failed: ${res.status}`
    try { const p = JSON.parse(text); if (p.error) msg = p.error } catch {}
    throw new Error(msg)
  }

  const blob = await res.blob()
  return { type: "blob", blob, contentType: blob.type || "image/png" }
}

// ── Google / Gemini (existing /api/nano-banana route) ──────────

async function generateViaGoogle(req: GenerationRequest): Promise<GenerationResult> {
  const res = await fetch("/api/nano-banana", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: req.prompt,
      model: req.model,
      referenceImages: req.referenceImages,
      stylePrompt: req.stylePrompt,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    let msg = `Generation failed: ${res.status}`
    try { const p = JSON.parse(text); if (p.error) msg = p.error } catch {}
    throw new Error(msg)
  }

  const ct = res.headers.get("content-type") || ""
  if (!ct.includes("image")) {
    const text = await res.text()
    throw new Error("No image generated")
  }

  const blob = await res.blob()
  return { type: "blob", blob, contentType: blob.type || "image/png" }
}

// ── SJinn (new /api/sjinn route — async polling) ───────────────

const SJINN_POLL_INTERVAL = 5_000  // 5 seconds
const SJINN_TIMEOUT = 5 * 60_000   // 5 minutes
const MAX_IMAGE_DIMENSION = 1024   // Max width/height for SJinn uploads
const MAX_IMAGE_QUALITY = 0.8      // JPEG quality

/**
 * Compress a data-URL image to fit within SJinn payload limits.
 * Returns a smaller JPEG data-URL (max 1024px, 80% quality).
 */
async function compressDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:image")) return dataUrl
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const scale = MAX_IMAGE_DIMENSION / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) { resolve(dataUrl); return }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL("image/jpeg", MAX_IMAGE_QUALITY))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

/** Compress all data-URL images in an array */
async function compressAll(urls: string[]): Promise<string[]> {
  return Promise.all(urls.map(compressDataUrl))
}

/**
 * Upload a data URL to temp storage and get a public HTTP URL back.
 * SJinn API requires http(s) URLs, not data URLs.
 */
async function uploadToTempUrl(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl // already a URL
  const compressed = await compressDataUrl(dataUrl)
  const res = await fetch("/api/temp-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl: compressed }),
  })
  if (!res.ok) throw new Error("Failed to upload temp image")
  const { url } = await res.json() as { url: string }
  return url
}

/** Upload multiple data URLs */
async function uploadAllToTempUrls(dataUrls: string[]): Promise<string[]> {
  return Promise.all(dataUrls.map(uploadToTempUrl))
}

async function generateViaSJinn(
  req: GenerationRequest,
  toolType: string,
  onProgress?: (p: GenerationProgress) => void,
): Promise<GenerationResult> {
  // Build tool-specific input params
  const input: Record<string, unknown> = { prompt: req.prompt || "" }

  if (req.aspectRatio) input.aspect_ratio = req.aspectRatio

  // SJinn uses different param names per tool category:
  // - image tools: image_list (array of reference URLs)
  // - video i2v / lipsync / motion: image (single URL string)
  // - lipsync: audio (URL string)
  // - motion: video (URL string)
  if (req.sourceImageUrl) {
    const imageUrl = await uploadToTempUrl(req.sourceImageUrl)
    if (toolType.includes("image-api") || toolType.includes("seedream")) {
      input.image_list = [imageUrl]
    } else {
      input.image = imageUrl
    }
  }
  if (req.referenceImages?.length && !input.image_list) {
    input.image_list = await uploadAllToTempUrls(req.referenceImages)
  }
  if (req.audioUrl) {
    input.audio = req.audioUrl.startsWith("data:") ? await uploadToTempUrl(req.audioUrl) : req.audioUrl
  }
  if (req.motionVideoUrl) {
    input.video = req.motionVideoUrl.startsWith("data:") ? await uploadToTempUrl(req.motionVideoUrl) : req.motionVideoUrl
  }

  // Create task
  const createRes = await fetch("/api/sjinn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool_type: toolType, input }),
  })

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "")
    let msg = `SJinn task creation failed: ${createRes.status}`
    try { const p = JSON.parse(text); if (p.error) msg = p.error } catch {}
    throw new Error(msg)
  }

  const { taskId } = await createRes.json() as { taskId: string }
  onProgress?.({ status: "queued", taskId })

  // Poll until done
  const start = Date.now()
  while (Date.now() - start < SJINN_TIMEOUT) {
    await sleep(SJINN_POLL_INTERVAL)

    const pollRes = await fetch(`/api/sjinn?taskId=${encodeURIComponent(taskId)}`)
    if (!pollRes.ok) {
      throw new Error(`SJinn poll failed: ${pollRes.status}`)
    }

    const data = await pollRes.json() as {
      status: number
      outputUrls?: string[]
      error?: string
    }

    if (data.status === 1 && data.outputUrls?.length) {
      onProgress?.({ status: "done", taskId })

      // Fetch the result as blob
      const resultRes = await fetch(data.outputUrls[0])
      const blob = await resultRes.blob()
      return { type: "blob", blob, contentType: blob.type || "video/mp4" }
    }

    if (data.status === -1) {
      onProgress?.({ status: "failed", taskId, error: data.error })
      throw new Error(data.error || "SJinn task failed")
    }

    onProgress?.({ status: "processing", taskId })
  }

  throw new Error("SJinn generation timed out (5 min)")
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
