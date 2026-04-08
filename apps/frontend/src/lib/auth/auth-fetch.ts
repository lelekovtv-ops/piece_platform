import { getAccessToken, setAccessToken, refreshApi } from "./auth-client"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4030"
const MAX_RETRIES = 2
const REQUEST_TIMEOUT_MS = 15_000
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503])

let currentTeamId: string | null = null

export function setCurrentTeamId(id: string | null) {
  currentTeamId = id
}

export function getCurrentTeamId(): string | null {
  return currentTeamId
}

function generateUUID(): string {
  return crypto.randomUUID()
}

function getRetryDelay(attempt: number, response?: Response): number {
  const retryAfter = response?.headers?.get("Retry-After")
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (!Number.isNaN(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, 10_000)
    }
  }
  return Math.min(2 ** attempt * 1000, 10_000)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
  headers.set("X-Correlation-ID", generateUUID())
  if (
    !headers.has("Content-Type") &&
    options?.body &&
    typeof options.body === "string"
  ) {
    headers.set("Content-Type", "application/json")
  }

  const callerSignal = options?.signal
  let res: Response | undefined
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const combinedSignal = callerSignal
      ? AbortSignal.any([callerSignal, controller.signal])
      : controller.signal

    try {
      res = await fetch(url, {
        ...options,
        headers,
        signal: combinedSignal,
      })
      clearTimeout(timeoutId)

      if (res.status === 401 && token && attempt === 0) {
        const r = await refreshApi()
        if (r) {
          setAccessToken(r.accessToken)
          headers.set("Authorization", `Bearer ${r.accessToken}`)
          res = await fetch(url, { ...options, headers, signal: combinedSignal })
        }
        return res
      }

      if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
        await sleep(getRetryDelay(attempt, res))
        continue
      }

      return res
    } catch (err) {
      clearTimeout(timeoutId)
      lastError = err

      if (
        err instanceof DOMException &&
        err.name === "AbortError" &&
        callerSignal?.aborted
      ) {
        throw err
      }

      if (err instanceof DOMException && err.name === "AbortError") {
        throw err
      }

      if (attempt < MAX_RETRIES) {
        await sleep(getRetryDelay(attempt))
        continue
      }

      throw err
    }
  }

  if (res) return res
  throw lastError
}
