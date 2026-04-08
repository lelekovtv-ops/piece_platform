import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockFindOne = vi.fn();
const mockUpdateOne = vi.fn();
const mockCollection = { findOne: mockFindOne, updateOne: mockUpdateOne };

vi.mock('@piece/multitenancy', () => ({
  getSystemCollection: vi.fn(() => mockCollection),
  getGlobalSystemCollection: vi.fn(() => mockCollection),
}));

vi.mock('@piece/validation/mongo', () => ({
  mongoIdUtils: {
    toObjectId: vi.fn((id) => id),
    toApiString: vi.fn((id) => id?.toString?.() ?? id),
  },
}));

vi.mock('../../../utils/logger.js', () => ({
  createComponentLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
}));

const { settingsService } = await import('../service.js');

describe('SettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProjectSetting', () => {
    it('should return data when found', async () => {
      mockFindOne.mockResolvedValueOnce({ data: { theme: 'dark' } });
      const result = await settingsService.getProjectSetting('team-1', 'proj-1', 'ui');
      expect(result).toEqual({ theme: 'dark' });
    });

    it('should return null when not found', async () => {
      mockFindOne.mockResolvedValueOnce(null);
      const result = await settingsService.getProjectSetting('team-1', 'proj-1', 'ui');
      expect(result).toBeNull();
    });
  });

  describe('setProjectSetting', () => {
    it('should upsert setting', async () => {
      mockUpdateOne.mockResolvedValueOnce({ upsertedCount: 1 });
      const result = await settingsService.setProjectSetting('team-1', 'proj-1', 'bible', { autoSync: true });
      expect(result).toEqual({ autoSync: true });
      expect(mockUpdateOne).toHaveBeenCalled();
    });
  });

  describe('getUserSetting', () => {
    it('should return data when found', async () => {
      mockFindOne.mockResolvedValueOnce({ data: { language: 'ru' } });
      const result = await settingsService.getUserSetting('user-1', 'preferences');
      expect(result).toEqual({ language: 'ru' });
    });
  });

  describe('setUserSetting', () => {
    it('should upsert user setting', async () => {
      mockUpdateOne.mockResolvedValueOnce({ upsertedCount: 1 });
      const result = await settingsService.setUserSetting('user-1', 'theme', { mode: 'dark' });
      expect(result).toEqual({ mode: 'dark' });
    });
  });
});
