import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockCreateIndex = vi.fn().mockResolvedValue('ok');
const mockCollection = vi.fn(() => ({ createIndex: mockCreateIndex }));

vi.mock('@piece/multitenancy', () => ({
  getGlobalSystemCollection: mockCollection,
}));

const { initializeSystemIndexes } = await import('../initialize-system-indexes.js');

describe('initializeSystemIndexes', () => {
  beforeEach(() => {
    mockCreateIndex.mockClear();
    mockCollection.mockClear();
  });

  it('should create indexes for all system collections', async () => {
    await initializeSystemIndexes();

    const collectionNames = mockCollection.mock.calls.map((c) => c[0]);
    expect(collectionNames).toContain('users');
    expect(collectionNames).toContain('teams');
    expect(collectionNames).toContain('team_members');
    expect(collectionNames).toContain('user_settings');
  });

  it('should create unique email index on users', async () => {
    await initializeSystemIndexes();

    expect(mockCreateIndex).toHaveBeenCalledWith(
      { email: 1 },
      { unique: true, sparse: true },
    );
  });

  it('should create unique compound index on team_members', async () => {
    await initializeSystemIndexes();

    expect(mockCreateIndex).toHaveBeenCalledWith(
      { teamId: 1, userId: 1 },
      { unique: true },
    );
  });

  it('should create unique compound index on user_settings', async () => {
    await initializeSystemIndexes();

    expect(mockCreateIndex).toHaveBeenCalledWith(
      { userId: 1, storeKey: 1 },
      { unique: true },
    );
  });

  it('should create ownerId index on teams', async () => {
    await initializeSystemIndexes();

    expect(mockCreateIndex).toHaveBeenCalledWith({ ownerId: 1 });
  });

  it('should create indexes for refresh_tokens collection', async () => {
    await initializeSystemIndexes();

    const collectionNames = mockCollection.mock.calls.map((c) => c[0]);
    expect(collectionNames).toContain('refresh_tokens');
  });

  it('should create tokenHash index on refresh_tokens', async () => {
    await initializeSystemIndexes();

    expect(mockCreateIndex).toHaveBeenCalledWith({ tokenHash: 1 });
  });

  it('should create userId index on refresh_tokens', async () => {
    await initializeSystemIndexes();

    expect(mockCreateIndex).toHaveBeenCalledWith({ userId: 1 });
  });

  it('should create TTL index on refresh_tokens expiresAt', async () => {
    await initializeSystemIndexes();

    expect(mockCreateIndex).toHaveBeenCalledWith(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 },
    );
  });
});
