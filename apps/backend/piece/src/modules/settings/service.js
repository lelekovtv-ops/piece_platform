import { getSystemCollection, getGlobalSystemCollection } from '@piece/multitenancy';
import { mongoIdUtils } from '@piece/validation/mongo';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('SettingsService');

async function getProjectSetting(teamId, projectId, storeKey) {
  const collection = getSystemCollection(teamId, 'project_settings');
  const doc = await collection.findOne({
    projectId: mongoIdUtils.toObjectId(projectId),
    storeKey,
  });
  return doc?.data ?? null;
}

async function setProjectSetting(teamId, projectId, storeKey, data) {
  const collection = getSystemCollection(teamId, 'project_settings');
  await collection.updateOne(
    { projectId: mongoIdUtils.toObjectId(projectId), storeKey },
    { $set: { data, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
  componentLogger.info('Project setting updated', { teamId, projectId, storeKey });
  return data;
}

async function getUserSetting(userId, storeKey) {
  const collection = getGlobalSystemCollection('user_settings');
  const doc = await collection.findOne({
    userId: mongoIdUtils.toObjectId(userId),
    storeKey,
  });
  return doc?.data ?? null;
}

async function setUserSetting(userId, storeKey, data) {
  const collection = getGlobalSystemCollection('user_settings');
  await collection.updateOne(
    { userId: mongoIdUtils.toObjectId(userId), storeKey },
    { $set: { data, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
  componentLogger.info('User setting updated', { userId, storeKey });
  return data;
}

export const settingsService = {
  getProjectSetting,
  setProjectSetting,
  getUserSetting,
  setUserSetting,
};
