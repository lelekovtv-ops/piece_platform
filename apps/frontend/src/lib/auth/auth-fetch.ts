import { getAccessToken, setAccessToken, refreshApi } from "./auth-client"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4030"

let currentTeamId: string | null = null

export function setCurrentTeamId(id: string | null) {
  currentTeamId = id
}

export function getCurrentTeamId(): string | null {
  return currentTeamId
}

export async function authFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`
  const headers = new Headers(options?.headers)

  const token = getAccessToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (currentTeamId) headers.set("x-selected-team", currentTeamId)
  if (
    !headers.has("Content-Type") &&
    options?.body &&
    typeof options.body === "string"
  ) {
    headers.set("Content-Type", "application/json")
  }

  let res = await fetch(url, { ...options, headers })

  if (res.status === 401 && token) {
    const r = await refreshApi()
    if (r) {
      setAccessToken(r.accessToken)
      headers.set("Authorization", `Bearer ${r.accessToken}`)
      res = await fetch(url, { ...options, headers })
    }
  }

  return res
}
