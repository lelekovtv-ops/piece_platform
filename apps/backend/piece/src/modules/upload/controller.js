import { uploadService } from './service.js';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('UploadController');

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/wav', 'audio/ogg',
  'application/pdf',
];
const MAX_FILENAME_LENGTH = 255;

async function presign(req, res) {
  try {
    const { filename, contentType, folder } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'filename and contentType are required',
      });
    }

    if (filename.length > MAX_FILENAME_LENGTH) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Filename must be ${MAX_FILENAME_LENGTH} characters or fewer`,
      });
    }

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Content type "${contentType}" is not allowed`,
        details: [`Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`],
      });
    }

    const result = await uploadService.createPresignedUpload({
      teamId: req.teamId,
      projectId: req.params.projectId || null,
      filename,
      contentType,
      folder,
    });

    res.json(result);
  } catch (error) {
    componentLogger.error('Presign failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to generate upload URL' });
  }
}

async function complete(req, res) {
  try {
    const { key, contentType } = req.body;

    if (!key) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'key is required',
      });
    }

    const result = await uploadService.confirmUpload(key, contentType);
    res.json(result);
  } catch (error) {
    if (error.code === 'UPLOAD_NOT_FOUND') {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    componentLogger.error('Upload confirm failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to confirm upload' });
  }
}

function tempUpload(req, res) {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'data (base64 data URL) is required',
      });
    }

    const result = uploadService.storeTempFile(data);
    res.status(201).json(result);
  } catch (error) {
    componentLogger.error('Temp upload failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to store temp file' });
  }
}

function getTempFile(req, res) {
  const data = uploadService.getTempFile(req.params.id);
  if (!data) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Temp file not found or expired' });
  }
  res.json({ data });
}

export const uploadController = {
  presign,
  complete,
  tempUpload,
  getTempFile,
};
