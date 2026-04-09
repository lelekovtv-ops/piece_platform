import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const connectMock = vi.fn().mockResolvedValue();
const closeMock = vi.fn().mockResolvedValue();
const dbMock = vi.fn((name) => ({
  name,
  collection: vi.fn((collectionName) => ({ collectionName })),
}));

vi.mock('mongodb', () => ({
  MongoClient: class MongoClient {
    constructor(uri, options) {
      this.uri = uri;
      this.options = options;
    }

    async connect() {
      return connectMock();
    }

    db(name) {
      return dbMock(name);
    }

    async close() {
      return closeMock();
    }
  },
}));

describe('multitenancy initializeMultiTenancy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const mod = await import('../index.js');
    await mod.closeConnection();
  });

  it('uses piece_system by default when systemDbName is not provided', async () => {
    const mod = await import('../index.js');

    await mod.initializeMultiTenancy('mongodb://localhost:27017');

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(dbMock).toHaveBeenCalledWith('piece_system');
  });

  it('uses custom systemDbName when provided in options', async () => {
    const mod = await import('../index.js');

    await mod.initializeMultiTenancy('mongodb://localhost:27017', {
      systemDbName: 'piece_system_custom',
    });

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(dbMock).toHaveBeenCalledWith('piece_system_custom');
  });
});
