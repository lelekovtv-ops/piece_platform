import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../utils/logger.js', () => ({
  createComponentLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
}));

const { searchImages } = await import('../services/image-search.js');

describe('searchImages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty array when no API key', async () => {
    const results = await searchImages('nature');
    expect(results).toEqual([]);
  });

  it('should return empty array on fetch error', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    const results = await searchImages('nature', { apiKey: 'test-key' });
    expect(results).toEqual([]);
  });

  it('should return empty array on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 429 });

    const results = await searchImages('nature', { apiKey: 'test-key' });
    expect(results).toEqual([]);
  });

  it('should parse Pexels response correctly', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        photos: [{
          id: 123,
          width: 1920,
          height: 1080,
          url: 'https://pexels.com/photo/123',
          photographer: 'Test',
          src: {
            original: 'https://images.pexels.com/original.jpg',
            large2x: 'https://images.pexels.com/large.jpg',
            medium: 'https://images.pexels.com/medium.jpg',
            small: 'https://images.pexels.com/small.jpg',
            tiny: 'https://images.pexels.com/tiny.jpg',
          },
          alt: 'Nature photo',
        }],
      }),
    });

    const results = await searchImages('nature', { apiKey: 'test-key' });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(123);
    expect(results[0].photographer).toBe('Test');
    expect(results[0].src.original).toContain('original.jpg');
  });
});
