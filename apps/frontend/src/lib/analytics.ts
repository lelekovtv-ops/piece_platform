import posthog from "posthog-js"

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"

let initialized = false

export function initAnalytics() {
  if (initialized || !POSTHOG_KEY || typeof window === "undefined") return
  if (process.env.NODE_ENV !== "production") return

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-mask]",
    },
    persistence: "localStorage+cookie",
    loaded: () => {
      initialized = true
    },
  })
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!initialized) return
  posthog.identify(userId, properties)
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return
  posthog.capture(event, properties)
}

export function resetAnalytics() {
  if (!initialized) return
  posthog.reset()
}
