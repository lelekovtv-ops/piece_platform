import { libraryService } from './service.js';
import { s3Service } from '../upload/s3.js';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('LibraryController');

async function create(req, res) {
  try {
    const { projectId, name, type, mimeType, size, s3Key, publicUrl, tags, origin, prompt, model } = req.body;

    if (!name || !s3Key) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'name and s3Key are required',
      });
    }

    const result = await libraryService.createFile(req.teamId, {
      projectId: projectId || null,
      name,
      type: type || 'other',
      mimeType: mimeType || 'application/octet-stream',
      size: size || 0,
      s3Key,
      publicUrl: publicUrl || '',
      tags: tags || [],
      origin: origin || 'uploaded',
      prompt: prompt || null,
      model: model || null,
      createdBy: req.user.id,
    });

    res.status(201).json(result);
  } catch (error) {
    componentLogger.error('Create library file failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create library file' });
  }
}

async function list(req, res) {
  try {
    const { projectId, origin, limit, offset } = req.query;

    const result = await libraryService.listFiles(req.teamId, {
      projectId,
      origin,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    res.json(result);
  } catch (error) {
    componentLogger.error('List library files failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list library files' });
  }
}

async function get(req, res) {
  try {
    const result = await libraryService.getFile(req.teamId, req.params.id);

    if (!result) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'File not found' });
    }

    res.json(result);
  } catch (error) {
    componentLogger.error('Get library file failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get library file' });
  }
}

async function update(req, res) {
  try {
    const { name, tags } = req.body;

    await libraryService.updateFile(req.teamId, req.params.id, { name, tags });
    res.json({ message: 'File updated' });
  } catch (error) {
    componentLogger.error('Update library file failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update library file' });
  }
}

async function remove(req, res) {
  try {
    const { s3Key } = await libraryService.deleteFile(req.teamId, req.params.id);

    if (s3Key) {
      try {
        await s3Service.deleteObject(s3Key);
      } catch {
        componentLogger.warn('S3 object cleanup failed', { s3Key });
      }
    }

    res.json({ message: 'File deleted' });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    componentLogger.error('Delete library file failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete library file' });
  }
}

export const libraryController = {
  create,
  list,
  get,
  update,
  remove,
};
