import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockCreateIndex = vi.fn().mockResolvedValue('ok');
const mockCollection = vi.fn(() => ({ createIndex: mockCreateIndex }));

vi.mock('@piece/multitenancy', () => ({
  getSystemCollection: mockCollection,
}));

const { initializeTeamDatabase } = await import('../initialize-team-database.js');

describe('initializeTeamDatabase', () => {
  const teamId = 'test-team-id';

  beforeEach(() => {
    mockCreateIndex.mockClear();
    mockCollection.mockClear();
  });

  it('should create indexes for all per-team collections', async () => {
    await initializeTeamDatabase(teamId);

    const collectionNames = mockCollection.mock.calls.map((c) => c[1]);
    expect(collectionNames).toContain('projects');
    expect(collectionNames).toContain('blocks');
    expect(collectionNames).toContain('rundown_entries');
    expect(collectionNames).toContain('bible_characters');
    expect(collectionNames).toContain('bible_locations');
    expect(collectionNames).toContain('bible_props');
    expect(collectionNames).toContain('project_settings');
    expect(collectionNames).toContain('operations');
    expect(collectionNames).toContain('scene_locks');
  });

  it('should pass correct teamId to every getSystemCollection call', async () => {
    await initializeTeamDatabase(teamId);

    for (const call of mockCollection.mock.calls) {
      expect(call[0]).toBe(teamId);
    }
  });

  it('should create TTL index on scene_locks.expiresAt', async () => {
    await initializeTeamDatabase(teamId);

    expect(mockCreateIndex).toHaveBeenCalledWith(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 },
    );
  });

  it('should create unique compound index on bible collection names per project', async () => {
    await initializeTeamDatabase(teamId);

    const uniqueNameCalls = mockCreateIndex.mock.calls.filter(
      (call) => call[0]?.projectId === 1 && call[0]?.name === 1 && call[1]?.unique === true,
    );
    expect(uniqueNameCalls.length).toBe(3);
  });

  it('should create unique compound index on project_settings', async () => {
    await initializeTeamDatabase(teamId);

    expect(mockCreateIndex).toHaveBeenCalledWith(
      { projectId: 1, storeKey: 1 },
      { unique: true },
    );
  });

  it('should create blocks index on projectId + order', async () => {
    await initializeTeamDatabase(teamId);

    expect(mockCreateIndex).toHaveBeenCalledWith({ projectId: 1, order: 1 });
  });
});
