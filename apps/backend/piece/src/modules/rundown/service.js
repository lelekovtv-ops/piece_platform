import { getSystemCollection } from '@piece/multitenancy';
import { mongoIdUtils } from '@piece/validation/mongo';
import { createComponentLogger } from '../../utils/logger.js';
import { buildRundownEntries, reconcileRundownEntries } from './services/builder.js';
import { flattenForTimeline, getTotalDuration } from './services/hierarchy.js';
import { screenplayService } from '../screenplay/service.js';

const componentLogger = createComponentLogger('RundownService');

function getEntriesCollection(teamId) {
  return getSystemCollection(teamId, 'rundown_entries');
}

function getEntries(teamId, projectId) {
  const collection = getEntriesCollection(teamId);
  return collection
    .find({ projectId: mongoIdUtils.toObjectId(projectId) })
    .sort({ order: 1 })
    .toArray();
}

async function saveEntries(teamId, projectId, entries) {
  const collection = getEntriesCollection(teamId);
  const projId = mongoIdUtils.toObjectId(projectId);

  const ops = [{ deleteMany: { filter: { projectId: projId } } }];

  const now = new Date();
  for (const entry of entries) {
    ops.push({
      insertOne: {
        document: {
          _id: entry.id,
          projectId: projId,
          ...entry,
          createdAt: now,
          updatedAt: now,
        },
      },
    });
  }

  if (ops.length > 1) {
    await collection.bulkWrite(ops, { ordered: true });
  }

  return entries;
}

async function rebuildFromBlocks(teamId, projectId) {
  const blocks = await screenplayService.listBlocks(teamId, projectId);
  const scenes = await screenplayService.getScenes(teamId, projectId);

  const newEntries = buildRundownEntries(blocks, scenes);

  const existingEntries = await getEntries(teamId, projectId);
  const reconciled = reconcileRundownEntries(newEntries, existingEntries);

  await saveEntries(teamId, projectId, reconciled);

  componentLogger.info('Rundown rebuilt', { teamId, projectId, entryCount: reconciled.length });

  return reconciled;
}

async function getTimeline(teamId, projectId) {
  const entries = await getEntries(teamId, projectId);
  return {
    positions: flattenForTimeline(entries),
    totalDurationMs: getTotalDuration(entries),
    entryCount: entries.length,
  };
}

async function batchUpdate(teamId, projectId, entries) {
  await saveEntries(teamId, projectId, entries);
  componentLogger.info('Rundown batch updated', { teamId, projectId, count: entries.length });
  return entries;
}

export const rundownService = {
  getEntries,
  rebuildFromBlocks,
  getTimeline,
  batchUpdate,
};
