import { authFetch } from "@/lib/auth/auth-fetch"
import { ENDPOINTS } from "./endpoints"

/**
 * Adapts Piece's single-call upload pattern to piece backend's presign+complete flow.
 *
 * Piece: apiGptImage("/api/upload", { body: { projectId, filename, contentType } })
 *       -> { uploadUrl, publicUrl, key }
 *
 * Piece: POST /v1/upload/presign -> { presignedUrl, key }
 *        PUT {presignedUrl} with file data
 *        POST /v1/upload/complete -> confirmation
 */
export async function getUploadUrl(
  projectId: string,
  filename: string,
  contentType?: string,
): Promise<{
  uploadUrl: string
  publicUrl: string
  key: string
  complete: () => Promise<Response>
}> {
  const presignRes = await authFetch(ENDPOINTS.uploadPresign, {
    method: "POST",
    body: JSON.stringify({
      filename,
      contentType: contentType || "application/octet-stream",
      folder: projectId,
    }),
  })

  if (!presignRes.ok) {
    throw new Error(`Upload presign failed: ${presignRes.status}`)
  }

  const data = await presignRes.json()

  return {
    uploadUrl: data.presignedUrl,
    publicUrl: data.publicUrl || "",
    key: data.key,
    complete: () =>
      authFetch(ENDPOINTS.uploadComplete, {
        method: "POST",
        body: JSON.stringify({ key: data.key, contentType: contentType || "application/octet-stream" }),
      }),
  }
}
