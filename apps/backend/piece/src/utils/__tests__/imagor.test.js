import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

const mockConfigValues = {
  IMAGOR_SECRET: 'test-secret-key',
  IMAGOR_BASE_URL: '/img',
  S3_BUCKET: 'piece-uploads',
};

vi.mock('../../config.js', () => ({
  // Mocks apps/backend/piece/src/config.js (resolved from src/utils/imagor.js)
  config: {
    get: vi.fn((key) => mockConfigValues[key]),
  },
}));

const { signImagorUrl, thumbnailUrl, previewUrl, videoThumbnailUrl } = await import('../imagor.js');

describe('imagor', () => {
  describe('signImagorUrl', () => {
    it('should produce a valid HMAC-SHA256 signed URL', () => {
      const path = 'fill/200x200/filters:quality(60)/piece-uploads/team1/uploads/photo.jpg';
      const result = signImagorUrl(path);

      const expectedHmac = createHmac('sha256', 'test-secret-key')
        .update(path)
        .digest('base64url');

      expect(result).toBe(`/img/${expectedHmac}/${path}`);
    });

    it('should return different signatures for different paths', () => {
      const url1 = signImagorUrl('fill/100x100/piece-uploads/a.jpg');
      const url2 = signImagorUrl('fill/200x200/piece-uploads/b.jpg');
      expect(url1).not.toBe(url2);
    });
  });

  describe('thumbnailUrl', () => {
    it('should generate a 200x200 thumbnail URL', () => {
      const result = thumbnailUrl('team1/uploads/photo.jpg');
      expect(result).toContain('fill/200x200');
      expect(result).toContain('quality(60)');
      expect(result).toContain('piece-uploads/team1/uploads/photo.jpg');
      expect(result).toMatch(/^\/img\/[A-Za-z0-9_-]+\//);
    });
  });

  describe('previewUrl', () => {
    it('should generate a 640x640 preview URL', () => {
      const result = previewUrl('team1/uploads/photo.jpg');
      expect(result).toContain('fit-in/640x640');
      expect(result).toContain('quality(75)');
      expect(result).toContain('piece-uploads/team1/uploads/photo.jpg');
      expect(result).toMatch(/^\/img\/[A-Za-z0-9_-]+\//);
    });
  });

  describe('videoThumbnailUrl', () => {
    it('should generate a 200x200 smart video thumbnail URL', () => {
      const result = videoThumbnailUrl('team1/uploads/clip.mp4');
      expect(result).toContain('200x200/smart');
      expect(result).toContain('quality(70)');
      expect(result).toContain('piece-uploads/team1/uploads/clip.mp4');
      expect(result).toMatch(/^\/img\/[A-Za-z0-9_-]+\//);
    });
  });
});

describe('signImagorUrl with empty secret', () => {
  it('should return null when secret is empty', () => {
    mockConfigValues.IMAGOR_SECRET = '';
    const result = signImagorUrl('fill/200x200/piece-uploads/a.jpg');
    expect(result).toBeNull();
  });

  it('should fallback to /storage/ URL in thumbnail when no secret', () => {
    mockConfigValues.IMAGOR_SECRET = '';
    const result = thumbnailUrl('team1/uploads/photo.jpg');
    expect(result).toBe('/storage/piece-uploads/team1/uploads/photo.jpg');
  });

  afterEach(() => {
    mockConfigValues.IMAGOR_SECRET = 'test-secret-key';
  });
});
