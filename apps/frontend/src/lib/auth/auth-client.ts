const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4030"

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
}

interface AuthResponse {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("piece-refresh-token")
}

export function setRefreshToken(token: string | null) {
  if (typeof window === "undefined") return
  if (token) localStorage.setItem("piece-refresh-token", token)
  else localStorage.removeItem("piece-refresh-token")
}

export async function loginApi(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.message || `Login failed: ${res.status}`)
  }
  return res.json()
}

export async function registerApi(
  email: string,
  password: string,
  name?: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.message || `Registration failed: ${res.status}`)
  }
  return res.json()
}

export async function refreshApi(): Promise<{ accessToken: string } | null> {
  const rt = getRefreshToken()
  if (!rt) return null
  const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: rt }),
  })
  if (!res.ok) {
    setRefreshToken(null)
    return null
  }
  return res.json()
}

export async function logoutApi(): Promise<void> {
  const rt = getRefreshToken()
  if (rt) {
    await fetch(`${API_BASE}/v1/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refreshToken: rt }),
    }).catch(() => {})
  }
  setAccessToken(null)
  setRefreshToken(null)
}

export async function getMeApi(): Promise<AuthUser | null> {
  if (!accessToken) return null
  const res = await fetch(`${API_BASE}/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return res.ok ? res.json() : null
}
