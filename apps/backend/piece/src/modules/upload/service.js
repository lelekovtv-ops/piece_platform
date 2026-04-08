import { randomBytes } from 'node:crypto';
import { s3Service } from './s3.js';
import { createComponentLogger } from '../../utils/logger.js';
import { thumbnailUrl, previewUrl, videoThumbnailUrl } from '../../utils/imagor.js';

const componentLogger = createComponentLogger('UploadService');

const tempStore = new Map();
const MAX_TEMP_FILES = 200;
const TEMP_TTL_MS = 30 * 60 * 1000;

const VIDEO_CONTENT_TYPES = ['video/mp4', 'video/webm'];
const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function createPresignedUpload({ teamId, projectId, filename, contentType, folder = 'uploads' }) {
  const key = s3Service.buildKey({ teamId, projectId, folder, filename });
  const result = await s3Service.getPresignedUploadUrl(key, contentType);

  componentLogger.info('Upload presigned', { teamId, projectId, key });
  return result;
}

async function confirmUpload(key, contentType) {
  const exists = await s3Service.objectExists(key);
  if (!exists) {
    const error = new Error('Object not found at the specified key');
    error.code = 'UPLOAD_NOT_FOUND';
    throw error;
  }

  const result = { key, publicUrl: s3Service.getPublicUrl(key) };

  if (contentType && VIDEO_CONTENT_TYPES.includes(contentType)) {
    result.thumbnailUrl = videoThumbnailUrl(key);
    result.previewUrl = videoThumbnailUrl(key);
  } else if (!contentType || IMAGE_CONTENT_TYPES.includes(contentType)) {
    result.thumbnailUrl = thumbnailUrl(key);
    result.previewUrl = previewUrl(key);
  }

  return result;
}

function storeTempFile(dataUrl) {
  cleanExpiredTemp();

  if (tempStore.size >= MAX_TEMP_FILES) {
    const oldest = tempStore.keys().next().value;
    tempStore.delete(oldest);
  }

  const id = randomBytes(16).toString('hex');
  tempStore.set(id, {
    data: dataUrl,
    createdAt: Date.now(),
  });

  componentLogger.info('Temp file stored', { id });
  return { id };
}

function getTempFile(id) {
  const entry = tempStore.get(id);
  if (!entry) return null;

  if (Date.now() - entry.createdAt > TEMP_TTL_MS) {
    tempStore.delete(id);
    return null;
  }

  return entry.data;
}

function cleanExpiredTemp() {
  const now = Date.now();
  for (const [id, entry] of tempStore) {
    if (now - entry.createdAt > TEMP_TTL_MS) {
      tempStore.delete(id);
    }
  }
}

async function deleteFile(key) {
  await s3Service.deleteObject(key);
  return { deleted: true, key };
}

export const uploadService = {
  createPresignedUpload,
  confirmUpload,
  storeTempFile,
  getTempFile,
  deleteFile,
};
