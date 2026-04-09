const DEFAULT_MAX_URLS = 500

/**
 * Tracks blob URLs created during a component's lifecycle
 * and revokes them on cleanup to prevent memory leaks.
 * Supports LRU eviction when max capacity is reached.
 */
export function createBlobUrlTracker(maxUrls: number = DEFAULT_MAX_URLS) {
  const urls = new Set<string>()
  const order: string[] = []

  function evictOldest(): void {
    while (order.length > maxUrls && order.length > 0) {
      const oldest = order.shift()!
      if (urls.has(oldest)) {
        URL.revokeObjectURL(oldest)
        urls.delete(oldest)
      }
    }
  }

  return {
    track(url: string): string {
      if (urls.has(url)) return url
      urls.add(url)
      order.push(url)
      evictOldest()
      return url
    },
    trackFromBlob(blob: Blob): string {
      const url = URL.createObjectURL(blob)
      return this.track(url)
    },
    revoke(url: string | null | undefined): void {
      if (!url || !url.startsWith("blob:")) return
      URL.revokeObjectURL(url)
      urls.delete(url)
      const idx = order.indexOf(url)
      if (idx !== -1) order.splice(idx, 1)
    },
    revokeAll(): void {
      for (const url of urls) {
        URL.revokeObjectURL(url)
      }
      urls.clear()
      order.length = 0
    },
    get size() {
      return urls.size
    },
    get maxSize() {
      return maxUrls
    },
  }
}

/**
 * Global blob URL tracker for store-level usage (shared across stores).
 * Components should create their own tracker via createBlobUrlTracker().
 */
export const globalBlobTracker = createBlobUrlTracker(DEFAULT_MAX_URLS)
