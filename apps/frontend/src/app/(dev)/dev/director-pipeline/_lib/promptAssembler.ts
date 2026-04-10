import { buildImagePrompt } from "@/lib/promptBuilder"
import type { CharacterEntry, LocationEntry, PropEntry } from "@/lib/bibleParser"
import type { TimelineShot } from "@/store/timeline"

export type GenerationMode = "omni" | "simple"

export interface PromptSegment {
  text: string
  type: "source" | "vision" | "camera" | "element" | "style"
}

export interface AssembledPrompt {
  raw: string
  segments: PromptSegment[]
  mode: GenerationMode
}

export function assemblePrompt(
  shot: TimelineShot,
  mode: GenerationMode,
  characters: CharacterEntry[],
  locations: LocationEntry[],
  props: PropEntry[],
  projectStyle: string,
): AssembledPrompt {
  if (mode === "simple") {
    const vision = shot.directorNote || shot.caption || ""
    const segments: PromptSegment[] = []
    if (vision) segments.push({ text: vision, type: "vision" })
    if (projectStyle) segments.push({ text: projectStyle, type: "style" })
    return {
      raw: [vision, projectStyle].filter(Boolean).join("\n\n"),
      segments,
      mode,
    }
  }

  // Omni mode: full prompt with segments for highlighting
  const segments: PromptSegment[] = []

  if (shot.sourceText) {
    segments.push({ text: shot.sourceText, type: "source" })
  }
  if (shot.directorNote) {
    segments.push({ text: shot.directorNote, type: "vision" })
  }

  const cameraParts: string[] = []
  if (shot.shotSize) cameraParts.push(shot.shotSize)
  // lens is not on TimelineShot — extracted from cameraNote if present
  const lensMatch = (shot.cameraNote || "").match(/\d+mm/i)
  if (lensMatch) cameraParts.push(lensMatch[0])
  if (shot.cameraMotion) cameraParts.push(shot.cameraMotion)
  if (cameraParts.length > 0) {
    segments.push({ text: cameraParts.join(", "), type: "camera" })
  }

  // Character/location @elements
  const mentionedChars = characters.filter((c) => {
    const text = `${shot.caption} ${shot.sourceText} ${shot.directorNote || ""}`.toUpperCase()
    return text.includes(c.name.toUpperCase())
  })
  const mentionedLocs = locations.filter((l) => {
    const text = `${shot.caption} ${shot.sourceText} ${shot.directorNote || ""}`.toUpperCase()
    return text.includes(l.name.toUpperCase())
  })

  for (const c of mentionedChars) {
    const desc = c.appearancePrompt || c.description || ""
    if (desc) segments.push({ text: `@${c.name}: ${desc}`, type: "element" })
  }
  for (const l of mentionedLocs) {
    const desc = l.appearancePrompt || l.description || ""
    if (desc) segments.push({ text: `@${l.name}: ${desc}`, type: "element" })
  }

  if (projectStyle) {
    segments.push({ text: projectStyle, type: "style" })
  }

  // Use existing buildImagePrompt for the raw prompt
  const raw = buildImagePrompt(shot, characters, locations, projectStyle, props)

  return { raw, segments, mode }
}
