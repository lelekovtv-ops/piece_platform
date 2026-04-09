import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockFindOne = vi.fn();
const mockFind = vi.fn();
const mockInsertOne = vi.fn();
const mockFindOneAndUpdate = vi.fn();
const mockDeleteOne = vi.fn();
const mockCountDocuments = vi.fn();
const mockToArray = vi.fn();
const mockSort = vi.fn(() => ({ skip: vi.fn(() => ({ limit: vi.fn(() => ({ toArray: mockToArray })) })) }));

const mockCollection = {
  findOne: mockFindOne,
  find: mockFind.mockReturnValue({ sort: mockSort }),
  insertOne: mockInsertOne,
  findOneAndUpdate: mockFindOneAndUpdate,
  deleteOne: mockDeleteOne,
  countDocuments: mockCountDocuments,
};

vi.mock('@piece/multitenancy', () => ({
  getSystemCollection: vi.fn(() => mockCollection),
}));

vi.mock('@piece/validation/mongo', () => ({
  mongoIdUtils: {
    toObjectId: vi.fn((id) => id),
    toApiString: vi.fn((id) => id?.toString?.() ?? id),
    isValid: vi.fn(() => true),
  },
}));

vi.mock('../../../utils/logger.js', () => ({
  createComponentLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
}));

const { projectService } = await import('../service.js');

describe('ProjectService', () => {
  const teamId = 'team-1';

  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockReturnValue({ sort: mockSort });
  });

  describe('create', () => {
    it('should create a project in team database', async () => {
      mockInsertOne.mockResolvedValueOnce({ insertedId: 'proj-1' });

      const result = await projectService.create(teamId, {
        name: 'My Film',
        description: 'A great film',
        ownerId: 'user-1',
      });

      expect(result.id).toBe('proj-1');
      expect(result.name).toBe('My Film');
      expect(result.description).toBe('A great film');
      expect(result.ownerId).toBe('user-1');
    });
  });

  describe('list', () => {
    it('should return paginated projects without filter (scope=all)', async () => {
      mockToArray.mockResolvedValueOnce([
        { _id: 'p1', name: 'Film 1', ownerId: 'u1', createdAt: new Date(), updatedAt: new Date() },
        { _id: 'p2', name: 'Film 2', ownerId: 'u2', createdAt: new Date(), updatedAt: new Date() },
      ]);
      mockCountDocuments.mockResolvedValueOnce(2);

      const result = await projectService.list(teamId);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(mockFind).toHaveBeenCalledWith({});
      expect(mockCountDocuments).toHaveBeenCalledWith({});
    });

    it('should filter by ownerId when provided (scope=my)', async () => {
      mockToArray.mockResolvedValueOnce([
        { _id: 'p1', name: 'My Film', ownerId: 'user-1', createdAt: new Date(), updatedAt: new Date() },
      ]);
      mockCountDocuments.mockResolvedValueOnce(1);

      const result = await projectService.list(teamId, { ownerId: 'user-1' });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(mockFind).toHaveBeenCalledWith({ ownerId: 'user-1' });
      expect(mockCountDocuments).toHaveBeenCalledWith({ ownerId: 'user-1' });
    });
  });

  describe('getById', () => {
    it('should return project by id', async () => {
      mockFindOne.mockResolvedValueOnce({
        _id: 'proj-1', name: 'Film', ownerId: 'u1', createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await projectService.getById(teamId, 'proj-1');

      expect(result.id).toBe('proj-1');
      expect(result.name).toBe('Film');
    });

    it('should return null for non-existent project', async () => {
      mockFindOne.mockResolvedValueOnce(null);

      const result = await projectService.getById(teamId, 'nope');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update allowed fields when user is the owner', async () => {
      mockFindOne.mockResolvedValueOnce({
        _id: 'proj-1', name: 'Old Name', ownerId: 'user-1', createdAt: new Date(), updatedAt: new Date(),
      });
      mockFindOneAndUpdate.mockResolvedValueOnce({
        _id: 'proj-1', name: 'New Name', ownerId: 'user-1', createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await projectService.update(teamId, 'proj-1', { name: 'New Name' }, { userId: 'user-1', userRole: 'manager' });

      expect(result.name).toBe('New Name');
    });

    it('should allow admin to update any project', async () => {
      mockFindOne.mockResolvedValueOnce({
        _id: 'proj-1', name: 'Old Name', ownerId: 'user-1', createdAt: new Date(), updatedAt: new Date(),
      });
      mockFindOneAndUpdate.mockResolvedValueOnce({
        _id: 'proj-1', name: 'Admin Edit', ownerId: 'user-1', createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await projectService.update(teamId, 'proj-1', { name: 'Admin Edit' }, { userId: 'admin-1', userRole: 'admin' });

      expect(result.name).toBe('Admin Edit');
    });

    it('should reject update from non-owner non-admin', async () => {
      mockFindOne.mockResolvedValueOnce({
        _id: 'proj-1', name: 'Film', ownerId: 'user-1', createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await projectService.update(teamId, 'proj-1', { name: 'Hacked' }, { userId: 'other-user', userRole: 'manager' });

      expect(result).toBeNull();
      expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should return null for non-existent project', async () => {
      mockFindOne.mockResolvedValueOnce(null);

      const result = await projectService.update(teamId, 'proj-1', { name: 'New' }, { userId: 'user-1', userRole: 'manager' });

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should delete project when user is the owner', async () => {
      mockFindOne.mockResolvedValueOnce({
        _id: 'proj-1', name: 'Film', ownerId: 'user-1', createdAt: new Date(), updatedAt: new Date(),
      });
      mockDeleteOne.mockResolvedValueOnce({ deletedCount: 1 });

      const result = await projectService.remove(teamId, 'proj-1', { userId: 'user-1', userRole: 'manager' });

      expect(result).toBe(true);
    });

    it('should allow admin to delete any project', async () => {
      mockFindOne.mockResolvedValueOnce({
        _id: 'proj-1', name: 'Film', ownerId: 'user-1', createdAt: new Date(), updatedAt: new Date(),
      });
      mockDeleteOne.mockResolvedValueOnce({ deletedCount: 1 });

      const result = await projectService.remove(teamId, 'proj-1', { userId: 'admin-1', userRole: 'owner' });

      expect(result).toBe(true);
    });

    it('should reject delete from non-owner non-admin', async () => {
      mockFindOne.mockResolvedValueOnce({
        _id: 'proj-1', name: 'Film', ownerId: 'user-1', createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await projectService.remove(teamId, 'proj-1', { userId: 'other-user', userRole: 'manager' });

      expect(result).toBe(false);
      expect(mockDeleteOne).not.toHaveBeenCalled();
    });

    it('should return false if project not found', async () => {
      mockFindOne.mockResolvedValueOnce(null);

      const result = await projectService.remove(teamId, 'nope', { userId: 'user-1', userRole: 'manager' });

      expect(result).toBe(false);
    });
  });
});
