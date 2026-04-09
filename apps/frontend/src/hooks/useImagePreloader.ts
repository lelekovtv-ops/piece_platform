'use client'

import { useEffect, useRef } from 'react'

const MAX_PRELOAD_QUEUE = 10

/**
 * Preloads the next N images to reduce visible loading time.
 * Uses `new Image()` to warm up the browser cache without DOM nodes.
 */
export function useImagePreloader(urls: (string | null | undefined)[], count: number = 4) {
  const preloadedRef = useRef(new Set<string>())

  useEffect(() => {
    const validUrls = urls
      .filter((url): url is string => !!url && !url.startsWith('blob:'))
      .filter((url) => !preloadedRef.current.has(url))
      .slice(0, Math.min(count, MAX_PRELOAD_QUEUE))

    for (const url of validUrls) {
      const img = new Image()
      img.src = url
      preloadedRef.current.add(url)
    }

    // Cap the set to prevent unbounded growth
    if (preloadedRef.current.size > 200) {
      const entries = Array.from(preloadedRef.current)
      preloadedRef.current = new Set(entries.slice(entries.length - 100))
    }
  }, [urls, count])
}
