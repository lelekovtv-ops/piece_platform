/**
 * Drop-in replacements for fetch("/api/...") calls.
 * Same interface as fetch() so existing code needs minimal changes.
 */

import { authFetch } from "@/lib/auth/auth-fetch"
import { chatViaBackend } from "./chat-adapter"
import { ENDPOINTS } from "./endpoints"

export { chatViaBackend } from "./chat-adapter"
export { getUploadUrl } from "./upload-adapter"
export { authFetch } from "@/lib/auth/auth-fetch"
export { ENDPOINTS } from "./endpoints"

/**
 * Drop-in replacement for apiChat("/api/chat", { body: JSON.stringify({...}) })
 * Parses the request body, adapts to piece backend format, transforms SSE to raw text.
 */
export async function apiChat(
  _url: string,
  init: RequestInit,
): Promise<Response> {
  const body = JSON.parse(init.body as string)
  return chatViaBackend(body, { signal: init.signal })
}

/**
 * Drop-in replacement for apiTranslate("/api/translate", { body: JSON.stringify({...}) })
 */
export async function apiTranslate(
  _url: string,
  init: RequestInit,
): Promise<Response> {
  return authFetch(ENDPOINTS.translate, {
    method: "POST",
    body: init.body,
  })
}

/**
 * Drop-in replacement for apiClassifyIntent("/api/classify-intent", { body: JSON.stringify({...}) })
 */
export async function apiClassifyIntent(
  _url: string,
  init: RequestInit,
): Promise<Response> {
  return authFetch(ENDPOINTS.classifyIntent, {
    method: "POST",
    body: init.body,
  })
}

/**
 * Drop-in replacement for apiSearchImages("/api/search-images", { body: JSON.stringify({...}) })
 * NOTE: requires projectId — uses first project from store or "default"
 */
export async function apiSearchImages(
  _url: string,
  init: RequestInit,
): Promise<Response> {
  return authFetch(ENDPOINTS.searchImages("default"), {
    method: "POST",
    body: init.body,
  })
}

/**
 * Drop-in replacement for apiNanoBanana("/api/nano-banana", { body: JSON.stringify({...}) })
 */
export async function apiNanoBanana(
  _url: string,
  init: RequestInit,
): Promise<Response> {
  return authFetch(ENDPOINTS.nanoBanana, {
    method: "POST",
    body: init.body,
  })
}

/**
 * Drop-in for apiGptImage("/api/gpt-image", {...})
 */
export async function apiGptImage(
  _url: string,
  init: RequestInit,
): Promise<Response> {
  return authFetch(ENDPOINTS.generateImage("default"), {
    method: "POST",
    body: init.body,
  })
}

/**
 * Drop-in for apiSjinnCreate("/api/sjinn", { method: "POST", ... })
 */
export async function apiSjinnCreate(
  _url: string,
  init: RequestInit,
): Promise<Response> {
  return authFetch(ENDPOINTS.sjinnCreate, {
    method: "POST",
    body: init.body,
  })
}

/**
 * Drop-in for fetch("/api/sjinn?taskId=xxx")
 */
export async function apiSjinnPoll(url: string): Promise<Response> {
  const taskId = new URL(url, "http://localhost").searchParams.get("taskId") || ""
  return authFetch(ENDPOINTS.sjinnPoll(taskId))
}

/**
 * Drop-in for apiTempUpload("/api/temp-upload", { method: "POST", ... })
 */
export async function apiTempUpload(
  _url: string,
  init: RequestInit,
): Promise<Response> {
  return authFetch(ENDPOINTS.uploadTemp, {
    method: "POST",
    body: init.body,
  })
}

/**
 * Drop-in for apiPhotoTo3d("/api/photo-to-3d", { method: "POST", ... })
 */
export async function apiPhotoTo3d(
  _url: string,
  init: RequestInit,
): Promise<Response> {
  return authFetch(ENDPOINTS.photoTo3dCreate, {
    method: "POST",
    body: init.body,
  })
}

/**
 * Drop-in for fetch("/api/photo-to-3d?taskId=xxx")
 */
export async function apiPhotoTo3dPoll(url: string): Promise<Response> {
  const taskId = new URL(url, "http://localhost").searchParams.get("taskId") || ""
  return authFetch(ENDPOINTS.photoTo3dPoll(taskId))
}

/**
 * Drop-in for apiAmbientImage("/api/ambient-image", {...})
 */
export async function apiAmbientImage(
  _url: string,
  init: RequestInit,
): Promise<Response> {
  return authFetch(ENDPOINTS.ambientImage, {
    method: "POST",
    body: init.body,
  })
}

/**
 * Drop-in for apiAmbientPrompt("/api/ambient-prompt", {...})
 */
export async function apiAmbientPrompt(
  _url: string,
  init: RequestInit,
): Promise<Response> {
  return authFetch(ENDPOINTS.ambientPrompt, {
    method: "POST",
    body: init.body,
  })
}

/**
 * Drop-in for apiSmartDistribute("/api/smart-distribute", {...})
 */
export async function apiSmartDistribute(
  _url: string,
  init: RequestInit,
): Promise<Response> {
  return authFetch(ENDPOINTS.smartDistribute, {
    method: "POST",
    body: init.body,
  })
}

/**
 * Drop-in for apiSplitVision("/api/split-vision", {...})
 */
export async function apiSplitVision(
  _url: string,
  init: RequestInit,
): Promise<Response> {
  return authFetch(ENDPOINTS.splitVision, {
    method: "POST",
    body: init.body,
  })
}

/**
 * Drop-in for apiCapabilities("/api/system-capabilities")
 */
export async function apiCapabilities(): Promise<Response> {
  return authFetch(ENDPOINTS.capabilities)
}
