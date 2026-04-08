import { getGlobalSystemCollection } from '@piece/multitenancy';
import { mongoIdUtils } from '@piece/validation/mongo';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('UserService');

function getUsersCollection() {
  return getGlobalSystemCollection('users');
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash: _pw, ...safe } = user;
  return {
    id: mongoIdUtils.toApiString(user._id),
    ...safe,
  };
}

async function list({ limit = 20, offset = 0, search } = {}) {
  const users = getUsersCollection();
  const filter = search
    ? { $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] }
    : {};

  const [data, total] = await Promise.all([
    users.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).toArray(),
    users.countDocuments(filter),
  ]);

  return {
    data: data.map(sanitizeUser),
    pagination: { total, limit, offset, hasMore: offset + limit < total },
  };
}

async function getById(id) {
  const users = getUsersCollection();
  const user = await users.findOne({ _id: mongoIdUtils.toObjectId(id) });
  return sanitizeUser(user);
}

function getByEmail(email) {
  const users = getUsersCollection();
  return users.findOne({ email: email.toLowerCase() });
}

async function update(id, updates) {
  const allowedFields = ['name', 'avatarUrl', 'language'];
  const $set = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      $set[field] = updates[field];
    }
  }
  if (Object.keys($set).length === 0) return getById(id);

  $set.updatedAt = new Date();

  const users = getUsersCollection();
  const result = await users.findOneAndUpdate(
    { _id: mongoIdUtils.toObjectId(id) },
    { $set },
    { returnDocument: 'after' },
  );
  if (!result) return null;

  componentLogger.info('User updated', { id });
  return sanitizeUser(result);
}

async function remove(id) {
  const users = getUsersCollection();
  const result = await users.deleteOne({ _id: mongoIdUtils.toObjectId(id) });
  if (result.deletedCount === 0) return false;
  componentLogger.info('User deleted', { id });
  return true;
}

export const userService = {
  list,
  getById,
  getByEmail,
  update,
  remove,
};
