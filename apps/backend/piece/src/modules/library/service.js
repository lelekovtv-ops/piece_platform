import { getSystemCollection } from '@piece/multitenancy';
import { mongoIdUtils } from '@piece/validation/mongo';
import { createComponentLogger } from '../../utils/logger.js';
import { thumbnailUrl, previewUrl, videoThumbnailUrl } from '../../utils/imagor.js';

const componentLogger = createComponentLogger('LibraryService');

const COLLECTION_NAME = 'library_files';

const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function getCollection(teamId) {
  return getSystemCollection(teamId, COLLECTION_NAME);
}

function generateUrls(s3Key, mimeType) {
  if (VIDEO_TYPES.includes(mimeType)) {
    return { thumbnailUrl: videoThumbnailUrl(s3Key), previewUrl: videoThumbnailUrl(s3Key) };
  }
  if (IMAGE_TYPES.includes(mimeType)) {
    return { thumbnailUrl: thumbnailUrl(s3Key), previewUrl: previewUrl(s3Key) };
  }
  return { thumbnailUrl: null, previewUrl: null };
}

function formatFile(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: mongoIdUtils.toApiString(_id), ...rest };
}

async function createFile(teamId, data) {
  const collection = getCollection(teamId);
  const urls = generateUrls(data.s3Key, data.mimeType);

  const doc = {
    projectId: data.projectId,
    name: data.name,
    type: data.type,
    mimeType: data.mimeType,
    size: data.size,
    s3Key: data.s3Key,
    publicUrl: data.publicUrl,
    thumbnailUrl: urls.thumbnailUrl,
    previewUrl: urls.previewUrl,
    tags: data.tags || [],
    origin: data.origin || 'uploaded',
    prompt: data.prompt || null,
    model: data.model || null,
    createdBy: data.createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(doc);
  componentLogger.info('Library file created', { teamId, fileId: result.insertedId, name: data.name });

  return formatFile({ _id: result.insertedId, ...doc });
}

async function listFiles(teamId, { projectId, origin, limit = 20, offset = 0 } = {}) {
  const collection = getCollection(teamId);
  const filter = {};

  if (projectId) filter.projectId = projectId;
  if (origin) filter.origin = origin;

  const [data, total] = await Promise.all([
    collection.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    data: data.map(formatFile),
    pagination: { total, limit, offset, hasMore: offset + limit < total },
  };
}

async function getFile(teamId, fileId) {
  const collection = getCollection(teamId);
  const doc = await collection.findOne({ _id: mongoIdUtils.toObjectId(fileId) });
  return formatFile(doc);
}

async function updateFile(teamId, fileId, updates) {
  const collection = getCollection(teamId);
  const setFields = { updatedAt: new Date() };

  if (updates.name !== undefined) setFields.name = updates.name;
  if (updates.tags !== undefined) setFields.tags = updates.tags;

  await collection.updateOne(
    { _id: mongoIdUtils.toObjectId(fileId) },
    { $set: setFields },
  );

  componentLogger.info('Library file updated', { teamId, fileId });
}

async function deleteFile(teamId, fileId) {
  const collection = getCollection(teamId);
  const doc = await collection.findOne({ _id: mongoIdUtils.toObjectId(fileId) });

  if (!doc) {
    const error = new Error('File not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  await collection.deleteOne({ _id: mongoIdUtils.toObjectId(fileId) });
  componentLogger.info('Library file deleted', { teamId, fileId, s3Key: doc.s3Key });

  return { s3Key: doc.s3Key };
}

export const libraryService = {
  createFile,
  listFiles,
  getFile,
  updateFile,
  deleteFile,
};
