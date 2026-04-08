/**
 * MongoDB mock collection helper.
 *
 * Creates a mock collection with full chainable query API for unit tests.
 *
 * Usage:
 *   import { createMockCollection } from '@piece/test-utils/helpers/mongodb';
 *
 *   const col = createMockCollection();
 *   col.findOne.mockResolvedValueOnce({ _id: '1', name: 'Alice' });
 *   col.find().sort().limit().toArray.mockResolvedValueOnce([...]);
 */

import { vi } from 'vitest';

/**
 * @returns {object} A mock MongoDB collection with commonly used methods.
 */
export function createMockCollection() {
  const toArray = vi.fn().mockResolvedValue([]);

  const chainable = () => ({
    toArray,
    sort: vi.fn().mockReturnValue({
      toArray,
      skip: vi.fn().mockReturnValue({
        toArray,
        limit: vi.fn().mockReturnValue({ toArray }),
      }),
      limit: vi.fn().mockReturnValue({ toArray }),
    }),
    skip: vi.fn().mockReturnValue({
      toArray,
      limit: vi.fn().mockReturnValue({ toArray }),
    }),
    limit: vi.fn().mockReturnValue({ toArray }),
    project: vi.fn().mockReturnValue({ toArray }),
  });

  return {
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockReturnValue(chainable()),
    insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id', acknowledged: true }),
    insertMany: vi.fn().mockResolvedValue({ insertedCount: 0, acknowledged: true }),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1, acknowledged: true }),
    updateMany: vi.fn().mockResolvedValue({ matchedCount: 0, modifiedCount: 0, acknowledged: true }),
    findOneAndUpdate: vi.fn().mockResolvedValue(null),
    findOneAndDelete: vi.fn().mockResolvedValue(null),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1, acknowledged: true }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0, acknowledged: true }),
    countDocuments: vi.fn().mockResolvedValue(0),
    createIndex: vi.fn().mockResolvedValue('index_name'),
    aggregate: vi.fn().mockReturnValue({ toArray }),
    bulkWrite: vi.fn().mockResolvedValue({ ok: 1 }),
    distinct: vi.fn().mockResolvedValue([]),

    // Expose toArray for direct assertion
    _toArray: toArray,
  };
}
