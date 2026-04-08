import { generateObject } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { DEFAULT_TEXT_MODEL_ID } from "@/lib/models"

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY })

const getModel = (modelId: string) => {
  if (modelId.startsWith("claude")) return anthropic(modelId)
  if (modelId.startsWith("gemini")) return google(modelId)
  if (modelId.startsWith("gpt")) return openai(modelId)
  return anthropic(DEFAULT_TEXT_MODEL_ID)
}

const SYSTEM = `You are a film director's assistant. You receive a director's VISION — a free-form description of how they see a shot.

Your job: split this vision into three structured fields for a professional storyboard card.

Rules:
- ACTION: What physically happens in the frame. Observable behavior only. 1-3 sentences. No camera terms.
- DIRECTOR: Emotional intent, atmosphere, subtext. What the audience should FEEL. 2-4 short lines. Poetic but clear.
- CAMERA: Technical camera parameters. Shot size (WIDE/MEDIUM/CLOSE/ECU/OTS/POV), lens (24mm/35mm/50mm/85mm/135mm), camera movement (Static/Push In/Pull Out/Pan/Track/Handheld/Steadicam/Crane/Drone). Also lighting notes if relevant.

If the vision is vague, infer reasonable defaults. Stay faithful to the director's intent.
Output in the same language as the input.`

const resultSchema = z.object({
  action: z.string().describe("What physically happens in frame"),
  director: z.string().describe("Emotional intent, atmosphere, subtext"),
  camera: z.string().describe("Shot size, lens, movement, lighting"),
})

export async function POST(req: Request) {
  try {
    const { vision, sceneContext, modelId } = await req.json()

    if (!vision || typeof vision !== "string") {
      return Response.json({ error: "vision is required" }, { status: 400 })
    }

    const userPrompt = [
      `VISION: ${vision}`,
      sceneContext ? `\nSCENE CONTEXT: ${sceneContext}` : "",
    ].filter(Boolean).join("\n")

    const result = await generateObject({
      model: getModel(modelId || DEFAULT_TEXT_MODEL_ID),
      system: SYSTEM,
      prompt: userPrompt,
      schema: resultSchema,
    })

    return Response.json(result.object)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[split-vision]", message)
    return Response.json({ error: message }, { status: 500 })
  }
}
