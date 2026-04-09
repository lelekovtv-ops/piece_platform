import { authFetch } from "@/lib/auth/auth-fetch"

export interface ProjectData {
  id: string
  name: string
  ownerId: string
  description: string
  createdAt: string
  updatedAt: string
}

interface ProjectListResponse {
  data: ProjectData[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export async function fetchProjects(
  params: { limit?: number; offset?: number } = {},
): Promise<ProjectListResponse> {
  const query = new URLSearchParams()
  if (params.limit) query.set("limit", String(params.limit))
  if (params.offset) query.set("offset", String(params.offset))

  const qs = query.toString()
  const url = `/v1/projects${qs ? `?${qs}` : ""}`

  const res = await authFetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Failed to fetch projects: ${res.status}`)
  }
  return res.json()
}

export async function fetchProjectById(
  projectId: string,
): Promise<ProjectData> {
  const res = await authFetch(`/v1/projects/${projectId}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Failed to fetch project: ${res.status}`)
  }
  return res.json()
}

export async function createProject(data: {
  name: string
  description?: string
}): Promise<ProjectData> {
  const res = await authFetch("/v1/projects", {
    method: "POST",
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Failed to create project: ${res.status}`)
  }
  return res.json()
}

export async function updateProject(
  projectId: string,
  data: { name?: string; description?: string },
): Promise<ProjectData> {
  const res = await authFetch(`/v1/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Failed to update project: ${res.status}`)
  }
  return res.json()
}

export async function deleteProject(projectId: string): Promise<void> {
  const res = await authFetch(`/v1/projects/${projectId}`, {
    method: "DELETE",
  })
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Failed to delete project: ${res.status}`)
  }
}
