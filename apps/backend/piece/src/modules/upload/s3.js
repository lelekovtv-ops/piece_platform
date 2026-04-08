import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../config.js';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('S3Service');

let client = null;

function getClient() {
  if (!client) {
    client = new S3Client({
      endpoint: config.get('S3_ENDPOINT'),
      region: config.get('S3_REGION'),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.get('S3_SECRET_ACCESS_KEY'),
      },
      forcePathStyle: true,
    });
  }
  return client;
}

function getBucket() {
  return config.get('S3_BUCKET');
}

function getPublicUrl(key) {
  return `${config.get('S3_PUBLIC_URL')}/${key}`;
}

async function getPresignedUploadUrl(key, contentType, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn });
  const publicUrl = getPublicUrl(key);

  componentLogger.info('Presigned URL generated', { key, contentType });

  return { uploadUrl, publicUrl, key };
}

async function deleteObject(key) {
  const command = new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });

  await getClient().send(command);
  componentLogger.info('Object deleted', { key });
}

async function objectExists(key) {
  try {
    const command = new HeadObjectCommand({
      Bucket: getBucket(),
      Key: key,
    });
    await getClient().send(command);
    return true;
  } catch {
    return false;
  }
}

function buildKey({ teamId, projectId, folder, filename }) {
  const parts = [];
  if (teamId) parts.push(teamId);
  if (projectId) parts.push(projectId);
  if (folder) parts.push(folder);
  parts.push(`${Date.now()}_${filename}`);
  return parts.join('/');
}

export const s3Service = {
  getPresignedUploadUrl,
  deleteObject,
  objectExists,
  buildKey,
  getPublicUrl,
};
