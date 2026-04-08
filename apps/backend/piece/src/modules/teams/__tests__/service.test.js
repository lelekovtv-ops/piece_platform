import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockFindOne = vi.fn();
const mockFind = vi.fn();
const mockInsertOne = vi.fn();
const mockFindOneAndUpdate = vi.fn();
const mockDeleteOne = vi.fn();
const mockToArray = vi.fn();
const mockSort = vi.fn(() => ({ toArray: mockToArray }));

const mockCollection = {
  findOne: mockFindOne,
  find: mockFind.mockReturnValue({ sort: mockSort, toArray: mockToArray }),
  insertOne: mockInsertOne,
  findOneAndUpdate: mockFindOneAndUpdate,
  deleteOne: mockDeleteOne,
};

vi.mock('@piece/multitenancy', () => ({
  getGlobalSystemCollection: vi.fn(() => mockCollection),
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

const mockCacheGet = vi.fn().mockResolvedValue(null);
const mockCacheSet = vi.fn().mockResolvedValue(undefined);
const mockCacheDel = vi.fn().mockResolvedValue(undefined);

vi.mock('@piece/cache', () => ({
  createCache: vi.fn(() => ({
    get: mockCacheGet,
    set: mockCacheSet,
    del: mockCacheDel,
  })),
  StandardTTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
}));

vi.mock('../../../db/index.js', () => ({
  initializeTeamDatabase: vi.fn().mockResolvedValue(undefined),
}));

const { teamService } = await import('../service.js');

describe('TeamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockReturnValue({ sort: mockSort, toArray: mockToArray });
  });

  describe('create', () => {
    it('should create a team and add owner as member', async () => {
      mockInsertOne.mockResolvedValueOnce({ insertedId: 'team-1' });
      mockInsertOne.mockResolvedValueOnce({ insertedId: 'member-1' });

      const result = await teamService.create({ name: 'My Team', ownerId: 'user-1' });

      expect(result.name).toBe('My Team');
      expect(result.ownerId).toBe('user-1');
      expect(mockInsertOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('listByUser', () => {
    it('should return empty array when user has no teams', async () => {
      mockFind.mockReturnValueOnce({ toArray: vi.fn().mockResolvedValueOnce([]) });

      const result = await teamService.listByUser('user-1');

      expect(result).toEqual([]);
    });

    it('should return teams with roles', async () => {
      mockFind
        .mockReturnValueOnce({
          toArray: vi.fn().mockResolvedValueOnce([
            { teamId: 'team-1', userId: 'user-1', role: 'owner' },
          ]),
        })
        .mockReturnValueOnce({
          sort: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValueOnce([
              { _id: 'team-1', name: 'Team A', ownerId: 'user-1', createdAt: new Date(), updatedAt: new Date() },
            ]),
          })),
        });

      const result = await teamService.listByUser('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('owner');
    });
  });

  describe('addMember', () => {
    it('should add a member to team', async () => {
      mockFindOne.mockResolvedValueOnce(null);
      mockInsertOne.mockResolvedValueOnce({ insertedId: 'member-2' });

      const result = await teamService.addMember('team-1', 'user-2', 'manager');

      expect(result.role).toBe('manager');
    });

    it('should throw ALREADY_MEMBER if user is already a member', async () => {
      mockFindOne.mockResolvedValueOnce({ teamId: 'team-1', userId: 'user-2' });

      await expect(
        teamService.addMember('team-1', 'user-2'),
      ).rejects.toThrow('User is already a member of this team');
    });
  });

  describe('removeMember', () => {
    it('should remove a member', async () => {
      mockDeleteOne.mockResolvedValueOnce({ deletedCount: 1 });

      const result = await teamService.removeMember('team-1', 'user-2');

      expect(result).toBe(true);
    });

    it('should return false if member not found', async () => {
      mockDeleteOne.mockResolvedValueOnce({ deletedCount: 0 });

      const result = await teamService.removeMember('team-1', 'user-99');

      expect(result).toBe(false);
    });
  });

  describe('getMemberRole', () => {
    it('should return role for existing member', async () => {
      mockFindOne.mockResolvedValueOnce({ role: 'admin' });

      const role = await teamService.getMemberRole('team-1', 'user-1');

      expect(role).toBe('admin');
    });

    it('should return null for non-member', async () => {
      mockFindOne.mockResolvedValueOnce(null);

      const role = await teamService.getMemberRole('team-1', 'user-99');

      expect(role).toBeNull();
    });

    it('should return cached role without DB query on cache hit', async () => {
      mockCacheGet.mockResolvedValueOnce('admin');

      const role = await teamService.getMemberRole('team-1', 'user-1');

      expect(role).toBe('admin');
      expect(mockFindOne).not.toHaveBeenCalled();
    });

    it('should cache role after DB query on cache miss', async () => {
      mockCacheGet.mockResolvedValueOnce(null);
      mockFindOne.mockResolvedValueOnce({ role: 'manager' });

      await teamService.getMemberRole('team-1', 'user-1');

      expect(mockCacheSet).toHaveBeenCalled();
    });
  });
});
