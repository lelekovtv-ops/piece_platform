import { generateContent } from "./client"
import type { GenerationProgress, GenerationResult } from "./types"

/**
 * Generate a lipsync video from a face image + audio track.
 * Uses SJinn's image-lipsync-api.
 */
export async function generateLipsync(
  imageUrl: string,
  audioUrl: string,
  onProgress?: (p: GenerationProgress) => void,
): Promise<GenerationResult> {
  return generateContent(
    {
      model: "sjinn-lipsync",
      prompt: "",
      sourceImageUrl: imageUrl,
      audioUrl,
    },
    onProgress,
  )
}
