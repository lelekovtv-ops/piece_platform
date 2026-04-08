import { getSystemCollection } from '@piece/multitenancy';
import { mongoIdUtils } from '@piece/validation/mongo';
import { createComponentLogger } from '../../utils/logger.js';
import { parseTextToBlocks, exportBlocksToText, reconcileBlockIds } from './services/parser.js';
import { parseScenes } from './services/scene-parser.js';
import { importFdx } from './services/importers/fdx-importer.js';
import { stripMarkdown } from './services/importers/markdown-importer.js';

const componentLogger = createComponentLogger('ScreenplayService');

function getBlocksCollection(teamId) {
  return getSystemCollection(teamId, 'blocks');
}

async function listBlocks(teamId, projectId) {
  const collection = getBlocksCollection(teamId);
  const blocks = await collection
    .find({ projectId: mongoIdUtils.toObjectId(projectId) })
    .sort({ order: 1 })
    .toArray();

  return blocks.map((b) => ({
    id: b._id,
    type: b.type,
    text: b.text,
    order: b.order,
    durationMs: b.durationMs ?? null,
    durationSrc: b.durationSrc ?? null,
    meta: b.meta ?? {},
  }));
}

async function batchUpdateBlocks(teamId, projectId, blocks) {
  const collection = getBlocksCollection(teamId);
  const projId = mongoIdUtils.toObjectId(projectId);

  const existingBlocks = await collection
    .find({ projectId: projId })
    .sort({ order: 1 })
    .toArray();

  const reconciledBlocks = reconcileBlockIds(
    existingBlocks.map((b) => ({ id: b._id, type: b.type, text: b.text })),
    blocks,
  );

  const ops = [];
  const now = new Date();

  ops.push({ deleteMany: { filter: { projectId: projId } } });

  for (let i = 0; i < reconciledBlocks.length; i++) {
    const block = reconciledBlocks[i];
    ops.push({
      insertOne: {
        document: {
          _id: block.id,
          projectId: projId,
          type: block.type,
          text: block.text,
          order: i,
          durationMs: block.durationMs ?? null,
          durationSrc: block.durationSrc ?? null,
          meta: block.meta ?? {},
          createdAt: now,
          updatedAt: now,
        },
      },
    });
  }

  if (ops.length > 0) {
    await collection.bulkWrite(ops, { ordered: true });
  }

  componentLogger.info('Blocks batch updated', { teamId, projectId, count: reconciledBlocks.length });

  return reconciledBlocks.map((b, i) => ({
    id: b.id,
    type: b.type,
    text: b.text,
    order: i,
    durationMs: b.durationMs ?? null,
    durationSrc: b.durationSrc ?? null,
    meta: b.meta ?? {},
  }));
}

async function importScreenplay(teamId, projectId, { text, format = 'plain' }) {
  let cleanText = text;

  if (format === 'markdown') {
    cleanText = stripMarkdown(text);
  }

  let blocks;
  if (format === 'fdx') {
    blocks = importFdx(text);
  } else {
    blocks = parseTextToBlocks(cleanText);
  }

  const result = await batchUpdateBlocks(teamId, projectId, blocks);

  componentLogger.info('Screenplay imported', { teamId, projectId, format, blockCount: result.length });

  return result;
}

async function exportScreenplay(teamId, projectId, format = 'text') {
  const blocks = await listBlocks(teamId, projectId);

  if (format === 'text' || format === 'fountain') {
    return exportBlocksToText(blocks);
  }

  return exportBlocksToText(blocks);
}

async function getScenes(teamId, projectId) {
  const blocks = await listBlocks(teamId, projectId);
  return parseScenes(blocks);
}

export const screenplayService = {
  listBlocks,
  batchUpdateBlocks,
  importScreenplay,
  exportScreenplay,
  getScenes,
};
