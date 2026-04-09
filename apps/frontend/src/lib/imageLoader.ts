/**
 * Custom Next.js Image loader for Imagor URLs.
 *
 * All image URLs in the app are pre-signed by the backend (imagor HMAC)
 * or direct /storage/ paths. The loader passes them through as-is —
 * no server-side optimization needed (imagorvideo handles resize/webp).
 *
 * Blob URLs (blob:) are also passed through unchanged.
 */

interface ImageLoaderParams {
  src: string
  width: number
  quality?: number
}

export default function imageLoader({ src }: ImageLoaderParams): string {
  // Blob URLs, data URLs, and pre-signed imagor URLs — pass through unchanged
  return src
}
