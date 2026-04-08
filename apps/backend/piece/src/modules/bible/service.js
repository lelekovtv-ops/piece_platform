import { getSystemCollection } from '@piece/multitenancy';
import { mongoIdUtils } from '@piece/validation/mongo';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('BibleService');

function getCollection(teamId, entityType) {
  const collectionMap = {
    characters: 'bible_characters',
    locations: 'bible_locations',
    props: 'bible_props',
  };
  const name = collectionMap[entityType];
  if (!name) throw new Error(`Unknown bible entity type: ${entityType}`);
  return getSystemCollection(teamId, name);
}

function list(teamId, projectId, entityType) {
  const collection = getCollection(teamId, entityType);
  return collection
    .find({ projectId: mongoIdUtils.toObjectId(projectId) })
    .sort({ name: 1 })
    .toArray()
    .then((docs) => docs.map((d) => ({ id: mongoIdUtils.toApiString(d._id), ...d, _id: undefined })));
}

async function getById(teamId, projectId, entityType, id) {
  const collection = getCollection(teamId, entityType);
  const doc = await collection.findOne({
    _id: mongoIdUtils.toObjectId(id),
    projectId: mongoIdUtils.toObjectId(projectId),
  });
  if (!doc) return null;
  return { id: mongoIdUtils.toApiString(doc._id), ...doc, _id: undefined };
}

async function create(teamId, projectId, entityType, data) {
  const collection = getCollection(teamId, entityType);
  const projId = mongoIdUtils.toObjectId(projectId);

  const existing = await collection.findOne({
    projectId: projId,
    name: data.name,
  });
  if (existing) {
    const error = new Error(`${entityType.slice(0, -1)} with this name already exists`);
    error.code = 'DUPLICATE_NAME';
    throw error;
  }

  const now = new Date();
  const result = await collection.insertOne({
    projectId: projId,
    ...data,
    createdAt: now,
    updatedAt: now,
  });

  componentLogger.info('Bible entry created', { teamId, projectId, entityType, name: data.name });
  return { id: mongoIdUtils.toApiString(result.insertedId), ...data, createdAt: now, updatedAt: now };
}

async function update(teamId, projectId, entityType, id, data) {
  const collection = getCollection(teamId, entityType);

  const { name: _name, ...updateData } = data;
  const $set = { ...updateData, updatedAt: new Date() };

  if (data.name !== undefined) {
    const existing = await collection.findOne({
      projectId: mongoIdUtils.toObjectId(projectId),
      name: data.name,
      _id: { $ne: mongoIdUtils.toObjectId(id) },
    });
    if (existing) {
      const error = new Error(`${entityType.slice(0, -1)} with this name already exists`);
      error.code = 'DUPLICATE_NAME';
      throw error;
    }
    $set.name = data.name;
  }

  const result = await collection.findOneAndUpdate(
    { _id: mongoIdUtils.toObjectId(id), projectId: mongoIdUtils.toObjectId(projectId) },
    { $set },
    { returnDocument: 'after' },
  );

  if (!result) return null;

  componentLogger.info('Bible entry updated', { teamId, projectId, entityType, id });
  return { id: mongoIdUtils.toApiString(result._id), ...result, _id: undefined };
}

async function remove(teamId, projectId, entityType, id) {
  const collection = getCollection(teamId, entityType);
  const result = await collection.deleteOne({
    _id: mongoIdUtils.toObjectId(id),
    projectId: mongoIdUtils.toObjectId(projectId),
  });
  if (result.deletedCount === 0) return false;

  componentLogger.info('Bible entry deleted', { teamId, projectId, entityType, id });
  return true;
}

export const bibleService = {
  list,
  getById,
  create,
  update,
  remove,
};
