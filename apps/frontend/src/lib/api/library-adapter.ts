import { authFetch } from "@/lib/auth/auth-fetch"
import { ENDPOINTS } from "./endpoints"

export interface LibraryFileResponse {
  id: string
  projectId: string | null
  name: string
  type: string
  mimeType: string
  size: number
  s3Key: string
  publicUrl: string
  thumbnailUrl: string | null
  previewUrl: string | null
  tags: string[]
  origin: string
  prompt: string | null
  model: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface LibraryListResponse {
  data: LibraryFileResponse[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export async function createLibraryFile(data: {
  projectId?: string
  name: string
  type: string
  mimeType: string
  size: number
  s3Key: string
  publicUrl: string
  tags?: string[]
  origin?: string
  prompt?: string
  model?: string
}): Promise<LibraryFileResponse> {
  const res = await authFetch(ENDPOINTS.library, {
    method: "POST",
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    throw new Error(`Failed to create library file: ${res.status}`)
  }

  return res.json()
}

export async function listLibraryFiles(params?: {
  projectId?: string
  origin?: string
  limit?: number
  offset?: number
}): Promise<LibraryListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.projectId) searchParams.set("projectId", params.projectId)
  if (params?.origin) searchParams.set("origin", params.origin)
  if (params?.limit) searchParams.set("limit", String(params.limit))
  if (params?.offset) searchParams.set("offset", String(params.offset))

  const url = `${ENDPOINTS.library}?${searchParams.toString()}`
  const res = await authFetch(url)

  if (!res.ok) {
    throw new Error(`Failed to list library files: ${res.status}`)
  }

  return res.json()
}

export async function deleteLibraryFile(id: string): Promise<void> {
  const res = await authFetch(ENDPOINTS.libraryFile(id), {
    method: "DELETE",
  })

  if (!res.ok) {
    throw new Error(`Failed to delete library file: ${res.status}`)
  }
}
