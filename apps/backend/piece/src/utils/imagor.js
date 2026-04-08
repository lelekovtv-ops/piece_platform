import { createHmac } from 'node:crypto';
import { config } from '../config.js';

function getSecret() {
  return config.get('IMAGOR_SECRET') || '';
}

function getBaseUrl() {
  return config.get('IMAGOR_BASE_URL') || '/img';
}

function getBucket() {
  return config.get('S3_BUCKET') || 'koza-uploads';
}

export function signImagorUrl(path) {
  const secret = getSecret();
  if (!secret) {
    return null;
  }
  const hmac = createHmac('sha256', secret).update(path).digest('base64url');
  return `${getBaseUrl()}/${hmac}/${path}`;
}

export function thumbnailUrl(key) {
  const bucket = getBucket();
  const path = `fill/200x200/filters:quality(60)/${bucket}/${key}`;
  const signed = signImagorUrl(path);
  return signed || `/storage/${bucket}/${key}`;
}

export function previewUrl(key) {
  const bucket = getBucket();
  const path = `fit-in/640x640/filters:quality(75)/${bucket}/${key}`;
  const signed = signImagorUrl(path);
  return signed || `/storage/${bucket}/${key}`;
}

export function videoThumbnailUrl(key) {
  const bucket = getBucket();
  const path = `200x200/smart/filters:quality(70)/${bucket}/${key}`;
  const signed = signImagorUrl(path);
  return signed || `/storage/${bucket}/${key}`;
}
