import { bibleService } from './service.js';
import { extractBibleFromBlocks } from './services/parser.js';
import { screenplayService } from '../screenplay/service.js';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('BibleController');

function createEntityHandlers(entityType) {
  return {
    async list(req, res) {
      try {
        const data = await bibleService.list(req.teamId, req.params.projectId, entityType);
        res.json({ data });
      } catch (error) {
        componentLogger.error(`Failed to list ${entityType}`, { error: error.message });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: `Failed to list ${entityType}` });
      }
    },

    async create(req, res) {
      try {
        const { name } = req.body;
        if (!name || name.trim().length === 0) {
          return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'name is required' });
        }
        const result = await bibleService.create(req.teamId, req.params.projectId, entityType, req.body);
        res.status(201).json(result);
      } catch (error) {
        if (error.code === 'DUPLICATE_NAME') {
          return res.status(409).json({ error: 'CONFLICT', message: error.message });
        }
        componentLogger.error(`Failed to create ${entityType}`, { error: error.message });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: `Failed to create ${entityType.slice(0, -1)}` });
      }
    },

    async update(req, res) {
      try {
        const result = await bibleService.update(req.teamId, req.params.projectId, entityType, req.params.id, req.body);
        if (!result) return res.status(404).json({ error: 'NOT_FOUND', message: `${entityType.slice(0, -1)} not found` });
        res.json(result);
      } catch (error) {
        if (error.code === 'DUPLICATE_NAME') {
          return res.status(409).json({ error: 'CONFLICT', message: error.message });
        }
        componentLogger.error(`Failed to update ${entityType}`, { error: error.message });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: `Failed to update ${entityType.slice(0, -1)}` });
      }
    },

    async remove(req, res) {
      try {
        const deleted = await bibleService.remove(req.teamId, req.params.projectId, entityType, req.params.id);
        if (!deleted) return res.status(404).json({ error: 'NOT_FOUND', message: `${entityType.slice(0, -1)} not found` });
        res.status(204).send();
      } catch (error) {
        componentLogger.error(`Failed to delete ${entityType}`, { error: error.message });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: `Failed to delete ${entityType.slice(0, -1)}` });
      }
    },
  };
}

const characterHandlers = createEntityHandlers('characters');
const locationHandlers = createEntityHandlers('locations');
const propHandlers = createEntityHandlers('props');

async function parseFromScreenplay(req, res) {
  try {
    const blocks = await screenplayService.listBlocks(req.teamId, req.params.projectId);
    const extracted = extractBibleFromBlocks(blocks);
    res.json(extracted);
  } catch (error) {
    componentLogger.error('Failed to parse bible', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to parse bible from screenplay' });
  }
}

export const bibleController = {
  characters: characterHandlers,
  locations: locationHandlers,
  props: propHandlers,
  parseFromScreenplay,
};
