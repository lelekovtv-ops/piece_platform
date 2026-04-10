import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockFindOne = vi.fn();
const mockFind = vi.fn();
const mockInsertOne = vi.fn();
const mockUpdateOne = vi.fn();
const mockDeleteOne = vi.fn();
const mockCountDocuments = vi.fn();
const mockToArray = vi.fn();
const mockSort = vi.fn(() => ({ skip: vi.fn(() => ({ limit: vi.fn(() => ({ toArray: mockToArray })) })) }));

const mockCollection = {
  findOne: mockFindOne,
  find: mockFind.mockReturnValue({ sort: mockSort }),
  insertOne: mockInsertOne,
  updateOne: mockUpdateOne,
  deleteOne: mockDeleteOne,
  countDocuments: mockCountDocuments,
};

vi.mock('@piece/multitenancy', () => ({
  getSystemCollection: vi.fn(() => mockCollection),
}));

vi.mock('@piece/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    createComponentLogger: vi.fn(() => ({
      info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    })),
  })),
}));

vi.mock('@piece/validation/mongo', () => ({
  mongoIdUtils: {
    toObjectId: vi.fn((id) => id),
    toApiString: vi.fn((id) => id?.toString?.() || id),
    isValid: vi.fn(() => true),
  },
}));

vi.mock('../../../utils/imagor.js', () => ({
  thumbnailUrl: vi.fn((key) => `/img/thumb/${key}`),
  previewUrl: vi.fn((key) => `/img/preview/${key}`),
  videoThumbnailUrl: vi.fn((key) => `/img/video/${key}`),
}));

const { libraryService } = await import('../service.js');

describe('LibraryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createFile', () => {
    it('should create a library file record', async () => {
      const insertedId = 'file-id-1';
      mockInsertOne.mockResolvedValueOnce({ insertedId });

      const result = await libraryService.createFile('team-1', {
        projectId: 'proj-1',
        name: 'photo.jpg',
        type: 'image',
        mimeType: 'image/jpeg',
        size: 12345,
        s3Key: 'team-1/proj-1/uploads/123_photo.jpg',
        publicUrl: '/storage/piece-uploads/team-1/proj-1/uploads/123_photo.jpg',
        tags: ['portrait'],
        origin: 'uploaded',
        createdBy: 'user-1',
      });

      expect(mockInsertOne).toHaveBeenCalledTimes(1);
      const inserted = mockInsertOne.mock.calls[0][0];
      expect(inserted.projectId).toBe('proj-1');
      expect(inserted.name).toBe('photo.jpg');
      expect(inserted.s3Key).toBe('team-1/proj-1/uploads/123_photo.jpg');
      expect(inserted.origin).toBe('uploaded');
      expect(inserted.createdBy).toBe('user-1');
      expect(inserted.createdAt).toBeInstanceOf(Date);
      expect(inserted.thumbnailUrl).toBeDefined();
      expect(result.id).toBe(insertedId);
    });

    it('should auto-generate imagor thumbnail URLs for images', async () => {
      mockInsertOne.mockResolvedValueOnce({ insertedId: 'file-id-2' });

      await libraryService.createFile('team-1', {
        projectId: 'proj-1',
        name: 'test.png',
        type: 'image',
        mimeType: 'image/png',
        size: 5000,
        s3Key: 'key/test.png',
        publicUrl: '/storage/piece-uploads/key/test.png',
        tags: [],
        origin: 'uploaded',
        createdBy: 'user-1',
      });

      const inserted = mockInsertOne.mock.calls[0][0];
      expect(inserted.thumbnailUrl).toBe('/img/thumb/key/test.png');
      expect(inserted.previewUrl).toBe('/img/preview/key/test.png');
    });

    it('should use video thumbnail URL for video files', async () => {
      mockInsertOne.mockResolvedValueOnce({ insertedId: 'file-id-3' });

      await libraryService.createFile('team-1', {
        projectId: 'proj-1',
        name: 'clip.mp4',
        type: 'video',
        mimeType: 'video/mp4',
        size: 50000,
        s3Key: 'key/clip.mp4',
        publicUrl: '/storage/piece-uploads/key/clip.mp4',
        tags: [],
        origin: 'uploaded',
        createdBy: 'user-1',
      });

      const inserted = mockInsertOne.mock.calls[0][0];
      expect(inserted.thumbnailUrl).toBe('/img/video/key/clip.mp4');
    });
  });

  describe('listFiles', () => {
    it('should return paginated files for a project', async () => {
      const files = [
        { _id: 'f1', name: 'a.jpg', projectId: 'proj-1', createdAt: new Date() },
        { _id: 'f2', name: 'b.jpg', projectId: 'proj-1', createdAt: new Date() },
      ];
      mockToArray.mockResolvedValueOnce(files);
      mockCountDocuments.mockResolvedValueOnce(2);

      const result = await libraryService.listFiles('team-1', {
        projectId: 'proj-1',
        limit: 20,
        offset: 0,
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.hasMore).toBe(false);
      expect(mockFind).toHaveBeenCalledWith({ projectId: 'proj-1' });
    });

    it('should filter by origin', async () => {
      mockToArray.mockResolvedValueOnce([]);
      mockCountDocuments.mockResolvedValueOnce(0);

      await libraryService.listFiles('team-1', {
        projectId: 'proj-1',
        origin: 'generated',
      });

      expect(mockFind).toHaveBeenCalledWith({ projectId: 'proj-1', origin: 'generated' });
    });
  });

  describe('getFile', () => {
    it('should return a file by id', async () => {
      mockFindOne.mockResolvedValueOnce({ _id: 'f1', name: 'photo.jpg' });

      const result = await libraryService.getFile('team-1', 'f1');

      expect(result).toBeDefined();
      expect(result.id).toBe('f1');
      expect(result.name).toBe('photo.jpg');
    });

    it('should return null for non-existent file', async () => {
      mockFindOne.mockResolvedValueOnce(null);

      const result = await libraryService.getFile('team-1', 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('updateFile', () => {
    it('should update name and tags', async () => {
      mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

      await libraryService.updateFile('team-1', 'f1', {
        name: 'renamed.jpg',
        tags: ['new-tag'],
      });

      expect(mockUpdateOne).toHaveBeenCalledTimes(1);
      const [filter, update] = mockUpdateOne.mock.calls[0];
      expect(filter._id).toBe('f1');
      expect(update.$set.name).toBe('renamed.jpg');
      expect(update.$set.tags).toEqual(['new-tag']);
      expect(update.$set.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('deleteFile', () => {
    it('should delete a file and return the s3Key', async () => {
      mockFindOne.mockResolvedValueOnce({ _id: 'f1', s3Key: 'team-1/proj-1/test.jpg' });
      mockDeleteOne.mockResolvedValueOnce({ deletedCount: 1 });

      const result = await libraryService.deleteFile('team-1', 'f1');

      expect(result.s3Key).toBe('team-1/proj-1/test.jpg');
      expect(mockDeleteOne).toHaveBeenCalledTimes(1);
    });

    it('should throw NOT_FOUND for non-existent file', async () => {
      mockFindOne.mockResolvedValueOnce(null);

      await expect(libraryService.deleteFile('team-1', 'non-existent'))
        .rejects.toThrow('File not found');
    });
  });
});
