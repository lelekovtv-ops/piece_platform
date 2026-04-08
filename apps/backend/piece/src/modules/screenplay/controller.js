import { screenplayService } from './service.js';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('ScreenplayController');

async function listBlocks(req, res) {
  try {
    const blocks = await screenplayService.listBlocks(req.teamId, req.params.projectId);
    res.json({ data: blocks });
  } catch (error) {
    componentLogger.error('Failed to list blocks', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list blocks' });
  }
}

async function batchUpdate(req, res) {
  try {
    const { blocks } = req.body;

    if (!Array.isArray(blocks)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'blocks array is required',
      });
    }

    const result = await screenplayService.batchUpdateBlocks(req.teamId, req.params.projectId, blocks);
    res.json({ data: result });
  } catch (error) {
    componentLogger.error('Failed to batch update blocks', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update blocks' });
  }
}

async function importScreenplay(req, res) {
  try {
    const { text, format } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'text is required',
      });
    }

    const result = await screenplayService.importScreenplay(
      req.teamId, req.params.projectId, { text, format },
    );
    res.json({ data: result, count: result.length });
  } catch (error) {
    componentLogger.error('Import failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to import screenplay' });
  }
}

async function exportScreenplay(req, res) {
  try {
    const { format } = req.params;
    const text = await screenplayService.exportScreenplay(req.teamId, req.params.projectId, format);
    res.type('text/plain').send(text);
  } catch (error) {
    componentLogger.error('Export failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to export screenplay' });
  }
}

async function getScenes(req, res) {
  try {
    const scenes = await screenplayService.getScenes(req.teamId, req.params.projectId);
    res.json({ data: scenes });
  } catch (error) {
    componentLogger.error('Failed to get scenes', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get scenes' });
  }
}

export const screenplayController = {
  listBlocks,
  batchUpdate,
  importScreenplay,
  exportScreenplay,
  getScenes,
};
