import { API_BASE } from "@/lib/api/endpoints"

export interface AuthTokens {
  accessToken: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  emailVerified?: boolean
}

interface AuthResponse {
  user: AuthUser
  accessToken: string
}

let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export async function loginApi(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
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
    credentials: "include",
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.message || `Registration failed: ${res.status}`)
  }
  return res.json()
}

let refreshPromise: Promise<{ accessToken: string } | null> | null = null

export async function refreshApi(): Promise<{ accessToken: string } | null> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })
      if (!res.ok) return null
      return res.json()
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function logoutApi(): Promise<void> {
  await fetch(`${API_BASE}/v1/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
  }).catch(() => {})
  setAccessToken(null)
}

export async function getMeApi(): Promise<AuthUser | null> {
  if (!accessToken) return null
  const res = await fetch(`${API_BASE}/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  })
  return res.ok ? res.json() : null
}

export async function resendVerificationApi(): Promise<{ message: string; devUrl?: string }> {
  const res = await fetch(`${API_BASE}/v1/auth/email/send-verification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.message || "Failed to send verification email")
  }
  return res.json()
}

export async function verifyEmailApi(token: string): Promise<{ message: string; verified: boolean }> {
  const res = await fetch(`${API_BASE}/v1/auth/email/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    credentials: "include",
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.message || "Verification failed")
  }
  return res.json()
}

export async function requestPasswordResetApi(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/v1/auth/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    credentials: "include",
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.message || "Request failed")
  }
  return res.json()
}

export async function confirmPasswordResetApi(token: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/v1/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
    credentials: "include",
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.message || "Reset failed")
  }
  return res.json()
}
