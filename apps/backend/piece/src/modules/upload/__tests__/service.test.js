import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../s3.js', () => ({
  s3Service: {
    getPresignedUploadUrl: vi.fn().mockResolvedValue({
      uploadUrl: 'https://minio/presigned',
      publicUrl: 'https://minio/public/key',
      key: 'team-1/proj-1/uploads/123_file.png',
    }),
    objectExists: vi.fn().mockResolvedValue(true),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    buildKey: vi.fn(({ teamId, projectId, folder, filename }) =>
      `${teamId}/${projectId}/${folder}/${Date.now()}_${filename}`),
    getPublicUrl: vi.fn((key) => `https://minio/public/${key}`),
  },
}));

vi.mock('../../../utils/logger.js', () => ({
  createComponentLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
}));

vi.mock('../../../utils/imagor.js', () => ({
  thumbnailUrl: vi.fn((key) => `/img/thumb/${key}`),
  previewUrl: vi.fn((key) => `/img/preview/${key}`),
  videoThumbnailUrl: vi.fn((key) => `/img/video/${key}`),
}));

const { uploadService } = await import('../service.js');

describe('UploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPresignedUpload', () => {
    it('should return presigned URL data', async () => {
      const result = await uploadService.createPresignedUpload({
        teamId: 'team-1',
        projectId: 'proj-1',
        filename: 'photo.png',
        contentType: 'image/png',
      });

      expect(result.uploadUrl).toBe('https://minio/presigned');
      expect(result.key).toContain('team-1');
    });
  });

  describe('confirmUpload', () => {
    it('should confirm existing object with image thumbnails', async () => {
      const result = await uploadService.confirmUpload('some/key', 'image/png');

      expect(result.key).toBe('some/key');
      expect(result.publicUrl).toContain('some/key');
      expect(result.thumbnailUrl).toBe('/img/thumb/some/key');
      expect(result.previewUrl).toBe('/img/preview/some/key');
    });

    it('should return video thumbnails for video content', async () => {
      const result = await uploadService.confirmUpload('some/video.mp4', 'video/mp4');

      expect(result.thumbnailUrl).toBe('/img/video/some/video.mp4');
    });

    it('should throw UPLOAD_NOT_FOUND if object does not exist', async () => {
      const { s3Service } = await import('../s3.js');
      s3Service.objectExists.mockResolvedValueOnce(false);

      await expect(uploadService.confirmUpload('missing/key'))
        .rejects.toThrow('Object not found');
    });
  });

  describe('storeTempFile / getTempFile', () => {
    it('should store and retrieve temp file', () => {
      const { id } = uploadService.storeTempFile('data:image/png;base64,abc123');

      expect(id).toHaveLength(32);

      const data = uploadService.getTempFile(id);
      expect(data).toBe('data:image/png;base64,abc123');
    });

    it('should return null for non-existent temp file', () => {
      const data = uploadService.getTempFile('nonexistent');
      expect(data).toBeNull();
    });
  });

  describe('deleteFile', () => {
    it('should delete object from S3', async () => {
      const result = await uploadService.deleteFile('some/key');

      expect(result.deleted).toBe(true);
      expect(result.key).toBe('some/key');
    });
  });
});
