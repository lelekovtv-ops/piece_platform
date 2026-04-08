import { getUploadUrl } from "./api/upload-adapter"
/**
 * Blob storage adapter — dual mode:
 * - Online + authenticated: upload to S3 (MinIO) via piece backend presign+complete
 * - Offline / not logged in: fallback to IndexedDB (existing fileStorage)
 *
 * Components call this instead of fileStorage directly.
 */

import { saveBlob, loadBlob, deleteBlob } from "./fileStorage"
import { authFetch } from "./auth/auth-fetch"

/**
 * Save a blob — tries S3 first, falls back to IndexedDB.
 * Returns the URL to access the file and the S3 key if remote.
 */
export async function saveBlobAdaptive(
  fileId: string,
  blob: Blob,
  projectId?: string,
): Promise<{ url: string; remote: boolean; s3Key?: string; thumbnailUrl?: string; previewUrl?: string }> {
  // Try remote upload via piece backend
  if (projectId) {
    try {
      const { uploadUrl, key, complete } = await getUploadUrl(
        projectId,
        `${fileId}.${extensionFromMime(blob.type)}`,
        blob.type || "image/webp",
      )

      // Upload directly to S3 via presigned URL
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": blob.type || "image/webp" },
      })

      if (uploadRes.ok) {
        // Confirm upload — get public URL + imagor thumbnails
        const completeRes = await complete()
        if (completeRes.ok) {
          const data = await completeRes.json()
          return {
            url: data.publicUrl || "",
            remote: true,
            s3Key: key,
            thumbnailUrl: data.thumbnailUrl,
            previewUrl: data.previewUrl,
          }
        }
      }
    } catch {
      // Fall through to local storage
    }
  }

  // Fallback: save to IndexedDB
  await saveBlob(fileId, blob)
  const url = await loadBlob(fileId)
  return { url: url || "", remote: false }
}

function extensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
  }
  return map[mime] || "bin"
}

/**
 * Load a blob URL — if it's a remote URL, return as-is.
 * If it's a local blob key, load from IndexedDB.
 */
export async function loadBlobAdaptive(
  urlOrKey: string,
): Promise<string | null> {
  // If it's already a URL (http/https or relative path), return directly
  if (
    urlOrKey.startsWith("http://") ||
    urlOrKey.startsWith("https://") ||
    urlOrKey.startsWith("/storage/") ||
    urlOrKey.startsWith("/img/")
  ) {
    return urlOrKey
  }

  // If it's a blob: URL, return directly (still valid in this session)
  if (urlOrKey.startsWith("blob:")) {
    return urlOrKey
  }

  // Otherwise it's an IndexedDB key — load from local storage
  return loadBlob(urlOrKey)
}

/**
 * Delete a blob — from both local and remote if applicable.
 */
export async function deleteBlobAdaptive(
  fileId: string,
  remoteKey?: string,
): Promise<void> {
  // Delete local
  try {
    await deleteBlob(fileId)
  } catch {
    // ignore
  }

  // Delete remote via piece backend library API
  if (remoteKey) {
    try {
      await authFetch(`/v1/library/${encodeURIComponent(remoteKey)}`, {
        method: "DELETE",
      })
    } catch {
      // ignore — cleanup is best-effort
    }
  }
}
