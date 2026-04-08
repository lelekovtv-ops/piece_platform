/**
 * vi.mock preset for piece/multitenancy.
 *
 * Import this file at the top of your test (before service imports)
 * to auto-mock all multitenancy functions with a shared mock collection.
 *
 * Usage:
 *   import '@piece/test-utils/mocks/multitenancy';
 *   // ... then import your service under test
 */

import { vi } from 'vitest';

const mockToArray = vi.fn().mockResolvedValue([]);
const mockLimit = vi.fn().mockReturnValue({ toArray: mockToArray });
const mockSkip = vi.fn().mockReturnValue({ limit: mockLimit, toArray: mockToArray });
const mockSort = vi.fn().mockReturnValue({ skip: mockSkip, limit: mockLimit, toArray: mockToArray });

export const mockCollection = {
  findOne: vi.fn().mockResolvedValue(null),
  find: vi.fn().mockReturnValue({ sort: mockSort, skip: mockSkip, limit: mockLimit, toArray: mockToArray }),
  insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id', acknowledged: true }),
  insertMany: vi.fn().mockResolvedValue({ insertedCount: 0, acknowledged: true }),
  updateOne: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1, acknowledged: true }),
  updateMany: vi.fn().mockResolvedValue({ matchedCount: 0, modifiedCount: 0, acknowledged: true }),
  deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1, acknowledged: true }),
  deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0, acknowledged: true }),
  countDocuments: vi.fn().mockResolvedValue(0),
  findOneAndUpdate: vi.fn().mockResolvedValue(null),
  findOneAndDelete: vi.fn().mockResolvedValue(null),
  createIndex: vi.fn().mockResolvedValue('index_name'),
  aggregate: vi.fn().mockReturnValue({ toArray: mockToArray }),
};

const mockDb = {
  collection: vi.fn(() => mockCollection),
};

vi.mock('@piece/multitenancy', () => ({
  initializeMultiTenancy: vi.fn().mockResolvedValue(undefined),
  getTeamDatabase: vi.fn(() => mockDb),
  getSystemCollection: vi.fn(() => mockCollection),
  getTableCollection: vi.fn(() => mockCollection),
  getSystemDb: vi.fn(() => mockDb),
  getGlobalSystemCollection: vi.fn(() => mockCollection),
  initializeSystemIndexes: vi.fn().mockResolvedValue(undefined),
}));

export { mockDb, mockToArray, mockSort, mockSkip, mockLimit };
