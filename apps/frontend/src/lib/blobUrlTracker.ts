/**
 * Tracks blob URLs created during a component's lifecycle
 * and revokes them on cleanup to prevent memory leaks.
 */
export function createBlobUrlTracker() {
  const urls = new Set<string>()

  return {
    track(url: string): string {
      urls.add(url)
      return url
    },
    revoke(url: string | null | undefined): void {
      if (!url || !url.startsWith("blob:")) return
      URL.revokeObjectURL(url)
      urls.delete(url)
    },
    revokeAll(): void {
      for (const url of urls) {
        URL.revokeObjectURL(url)
      }
      urls.clear()
    },
    get size() {
      return urls.size
    },
  }
}
