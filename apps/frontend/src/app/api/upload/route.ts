import { NextResponse } from "next/server"
import { getPresignedUploadUrl, getPublicUrl } from "@/lib/s3Client"

export async function POST(req: Request) {
  try {
    // Auth check: verify Bearer token exists (temporary — this route moves to backend in Phase 5)
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { projectId, filename, contentType } = await req.json()

    if (!projectId || !filename) {
      return NextResponse.json({ error: "projectId and filename required" }, { status: 400 })
    }

    const key = `uploads/${projectId}/${filename}`

    const uploadUrl = await getPresignedUploadUrl(key, contentType || "image/webp")
    const publicUrl = getPublicUrl(key)

    return NextResponse.json({ uploadUrl, publicUrl, key })
  } catch (err) {
    console.error("[upload]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
