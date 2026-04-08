import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

/**
 * Temporary file upload endpoint.
 * Accepts base64 data URL → uploads to tmpfiles.org → returns public URL.
 *
 * POST: { dataUrl: "data:image/jpeg;base64,..." }
 * Returns: { url: "https://tmpfiles.org/dl/...", id: "xxx" }
 *
 * GET: ?id=xxx → serves from in-memory cache (fallback for local use)
 */

const fileStore = new Map<string, { buffer: Buffer; mime: string; createdAt: number }>()

// Cleanup files older than 30 minutes
function cleanup() {
  const now = Date.now()
  for (const [id, entry] of fileStore) {
    if (now - entry.createdAt > 30 * 60_000) {
      fileStore.delete(id)
    }
  }
}

/**
 * Upload buffer to tmpfiles.org and return a direct-download URL.
 * Free, no API key needed, files expire in 1 hour.
 */
async function uploadToTmpFiles(buffer: Buffer, filename: string, mime: string): Promise<string> {
  // Build multipart/form-data manually for reliable Node.js server-side upload
  const boundary = `----KozaUpload${Date.now()}`
  const header = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mime}\r\n\r\n`
  )
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
  const body = Buffer.concat([header, buffer, footer])

  const res = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`tmpfiles.org upload failed: ${res.status} ${text.slice(0, 200)}`)
  }

  const data = await res.json() as { status: string; data?: { url: string } }
  if (data.status !== "success" || !data.data?.url) {
    throw new Error("tmpfiles.org returned no URL")
  }

  // tmpfiles.org returns URL like https://tmpfiles.org/12345/file.jpg
  // Direct download URL is https://tmpfiles.org/dl/12345/file.jpg
  return data.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/")
}

export async function POST(req: NextRequest) {
  try {
    const { dataUrl } = await req.json() as { dataUrl?: string }

    if (!dataUrl || !dataUrl.startsWith("data:")) {
      return NextResponse.json({ error: "dataUrl required (data:...)" }, { status: 400 })
    }

    // Parse data URL
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      return NextResponse.json({ error: "Invalid data URL format" }, { status: 400 })
    }

    const mime = match[1]
    const buffer = Buffer.from(match[2], "base64")
    const id = randomUUID()
    const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg"
      : mime.includes("png") ? "png"
      : mime.includes("webp") ? "webp"
      : mime.includes("mp4") ? "mp4"
      : mime.includes("wav") ? "wav"
      : mime.includes("mp3") ? "mp3"
      : "bin"

    // Store in memory for local GET fallback
    fileStore.set(id, { buffer, mime, createdAt: Date.now() })
    cleanup()

    // Upload to public temp hosting
    const filename = `${id}.${ext}`
    let publicUrl: string

    try {
      publicUrl = await uploadToTmpFiles(buffer, filename, mime)
      console.log("[temp-upload] uploaded to tmpfiles.org:", publicUrl)
    } catch (err) {
      // Fallback to local serving if tmpfiles.org is down
      console.warn("[temp-upload] tmpfiles.org failed, falling back to local:", err)
      const origin = req.nextUrl.origin
      publicUrl = `${origin}/api/temp-upload?id=${id}`
    }

    return NextResponse.json({ url: publicUrl, id })
  } catch (err) {
    console.error("[temp-upload] error:", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 })
  }

  const entry = fileStore.get(id)
  if (!entry) {
    return NextResponse.json({ error: "File not found or expired" }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(entry.buffer), {
    headers: {
      "Content-Type": entry.mime,
      "Cache-Control": "public, max-age=1800",
    },
  })
}
