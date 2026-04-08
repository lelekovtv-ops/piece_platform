import { createComponentLogger } from '../../../utils/logger.js';

const componentLogger = createComponentLogger('ImageSearch');

const PEXELS_BASE = 'https://api.pexels.com/v1';

export async function searchImages(query, { apiKey, perPage = 12 } = {}) {
  if (!apiKey) {
    componentLogger.warn('No Pexels API key, returning empty results');
    return [];
  }

  try {
    const url = `${PEXELS_BASE}/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;
    const response = await fetch(url, {
      headers: { Authorization: apiKey },
    });

    if (!response.ok) {
      componentLogger.warn('Pexels search failed', { status: response.status });
      return [];
    }

    const data = await response.json();

    return (data.photos || []).map((photo) => ({
      id: photo.id,
      width: photo.width,
      height: photo.height,
      url: photo.url,
      photographer: photo.photographer,
      src: {
        original: photo.src.original,
        large: photo.src.large2x || photo.src.large,
        medium: photo.src.medium,
        small: photo.src.small,
        thumbnail: photo.src.tiny,
      },
      alt: photo.alt || query,
    }));
  } catch (error) {
    componentLogger.error('Image search failed', { error: error.message });
    return [];
  }
}
