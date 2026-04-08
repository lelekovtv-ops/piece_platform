import { NextRequest, NextResponse } from "next/server"

/**
 * SJinn.ai proxy route — async task-based generation.
 *
 * Flow:
 *   1. POST /api/sjinn  { tool_type, input }  → creates task
 *   2. GET  /api/sjinn?taskId=xxx             → polls status
 *
 * Env: SJINN_API_KEY
 */

const SJINN_BASE = "https://sjinn.ai/api/un-api"

function getApiKey(): string {
  const key = process.env.SJINN_API_KEY
  if (!key) throw new Error("SJINN_API_KEY not set in .env.local")
  return key
}

/* ── POST: create task ── */
export async function POST(req: NextRequest) {
  try {
    const apiKey = getApiKey()
    const body = await req.json()
    const { tool_type, input } = body as { tool_type?: string; input?: Record<string, unknown> }

    if (!tool_type || !input) {
      return NextResponse.json({ error: "tool_type and input are required" }, { status: 400 })
    }

    // Log what we're sending (strip image data for brevity)
    const debugInput = { ...input }
    if (typeof debugInput.image === "string" && debugInput.image.length > 100) debugInput.image = `[data-url ${debugInput.image.length} chars]`
    if (Array.isArray(debugInput.image_list)) debugInput.image_list = debugInput.image_list.map((u: string) => typeof u === "string" && u.length > 100 ? `[data-url ${u.length} chars]` : u)
    console.log("[sjinn] create task:", { tool_type, input: debugInput })

    const res = await fetch(`${SJINN_BASE}/create_tool_task`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tool_type, input }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[sjinn] create failed:", res.status, err)
      return NextResponse.json({ error: `SJinn create failed: ${res.statusText} ${err}` }, { status: res.status })
    }

    const data = await res.json() as {
      success: boolean
      errorMsg: string
      error_code: number
      data?: { task_id: string }
    }

    console.log("[sjinn] create response:", { success: data.success, errorMsg: data.errorMsg, error_code: data.error_code, hasTaskId: !!data.data?.task_id })

    if (!data.success || !data.data?.task_id) {
      return NextResponse.json(
        { error: data.errorMsg || "SJinn returned no task_id", error_code: data.error_code },
        { status: 400 },
      )
    }

    return NextResponse.json({ taskId: data.data.task_id })
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

    const res = await fetch(`${SJINN_BASE}/query_tool_task_status`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ task_id: taskId }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `SJinn poll failed: ${err}` }, { status: 500 })
    }

    const data = await res.json() as {
      success: boolean
      errorMsg: string
      error_code: number
      data?: {
        task_id: string
        status: number  // 0=processing, 1=done, -1=failed
        output_urls?: string[]
      }
    }

    if (!data.success || !data.data) {
      return NextResponse.json({ error: data.errorMsg || "Poll error" }, { status: 500 })
    }

    return NextResponse.json({
      taskId: data.data.task_id,
      status: data.data.status,
      outputUrls: data.data.output_urls || [],
      error: data.data.status === -1 ? (data.errorMsg || "Task failed") : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
