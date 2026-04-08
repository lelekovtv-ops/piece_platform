import { NextRequest, NextResponse } from "next/server"

/**
 * Photo → 3D model via Tripo3D API
 *
 * Flow:
 *   1. POST /api/photo-to-3d  { image: base64 }  → creates task
 *   2. GET  /api/photo-to-3d?taskId=xxx           → polls status, returns GLB url
 *
 * Env: TRIPO_API_KEY
 */

const TRIPO_BASE = "https://api.tripo3d.ai/v2/openapi"

function getApiKey(): string {
  const key = process.env.TRIPO_API_KEY
  if (!key) throw new Error("TRIPO_API_KEY not set in .env.local")
  return key
}

/* ── POST: upload image → create task ── */
export async function POST(req: NextRequest) {
  try {
    const apiKey = getApiKey()
    const body = await req.json()
    const { image } = body as { image?: string }

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    // Step 1: Upload image to Tripo
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")

    const formData = new FormData()
    formData.append("file", new Blob([buffer], { type: "image/png" }), "photo.png")

    const uploadRes = await fetch(`${TRIPO_BASE}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      return NextResponse.json({ error: `Upload failed: ${err}` }, { status: 500 })
    }

    const uploadData = (await uploadRes.json()) as {
      code: number
      data: { image_token: string }
    }
    const imageToken = uploadData.data.image_token

    // Step 2: Create image-to-model task
    const taskRes = await fetch(`${TRIPO_BASE}/task`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "image_to_model",
        file: { type: "image", file_token: imageToken },
      }),
    })

    if (!taskRes.ok) {
      const err = await taskRes.text()
      return NextResponse.json({ error: `Task creation failed: ${err}` }, { status: 500 })
    }

    const taskData = (await taskRes.json()) as {
      code: number
      data: { task_id: string }
    }

    return NextResponse.json({
      taskId: taskData.data.task_id,
      status: "queued",
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ── GET: poll task status ── */
export async function GET(req: NextRequest) {
  try {
    const apiKey = getApiKey()
    const taskId = req.nextUrl.searchParams.get("taskId")

    if (!taskId) {
      return NextResponse.json({ error: "No taskId" }, { status: 400 })
    }

    const res = await fetch(`${TRIPO_BASE}/task/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Poll failed: ${err}` }, { status: 500 })
    }

    const data = (await res.json()) as {
      code: number
      data: {
        task_id: string
        status: string
        progress: number
        output?: { model?: string }
      }
    }

    const task = data.data
    const result: Record<string, unknown> = {
      taskId: task.task_id,
      status: task.status,
      progress: task.progress,
    }

    // When done, return the model URL (GLB)
    if (task.status === "success" && task.output?.model) {
      result.modelUrl = task.output.model
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
