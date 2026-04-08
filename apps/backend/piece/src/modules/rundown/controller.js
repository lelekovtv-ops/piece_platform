import { rundownService } from './service.js';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('RundownController');

async function getEntries(req, res) {
  try {
    const entries = await rundownService.getEntries(req.teamId, req.params.projectId);
    res.json({ data: entries });
  } catch (error) {
    componentLogger.error('Failed to get rundown', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get rundown' });
  }
}

async function rebuild(req, res) {
  try {
    const entries = await rundownService.rebuildFromBlocks(req.teamId, req.params.projectId);
    res.json({ data: entries, count: entries.length });
  } catch (error) {
    componentLogger.error('Failed to rebuild rundown', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to rebuild rundown' });
  }
}

async function batchUpdate(req, res) {
  try {
    const { entries } = req.body;

    if (!Array.isArray(entries)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'entries array is required',
      });
    }

    const result = await rundownService.batchUpdate(req.teamId, req.params.projectId, entries);
    res.json({ data: result });
  } catch (error) {
    componentLogger.error('Failed to update rundown', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update rundown' });
  }
}

async function getTimeline(req, res) {
  try {
    const timeline = await rundownService.getTimeline(req.teamId, req.params.projectId);
    res.json(timeline);
  } catch (error) {
    componentLogger.error('Failed to get timeline', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get timeline' });
  }
}

export const rundownController = {
  getEntries,
  rebuild,
  batchUpdate,
  getTimeline,
};
