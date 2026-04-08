import { pipelineService } from './service.js';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('PipelineController');

async function run(req, res) {
  try {
    const { nodes, edges, context, provider } = req.body;

    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'nodes array is required' });
    }

    const results = await pipelineService.run(req.teamId, req.params.projectId, {
      nodes, edges: edges || [], context, provider,
    });
    res.json({ results });
  } catch (error) {
    componentLogger.error('Pipeline execution failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Pipeline execution failed' });
  }
}

async function listPresets(req, res) {
  try {
    const presets = await pipelineService.listPresets(req.teamId, req.params.projectId);
    res.json({ data: presets });
  } catch (error) {
    componentLogger.error('Failed to list presets', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list presets' });
  }
}

async function savePreset(req, res) {
  try {
    const { name, nodes, edges } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'name is required' });
    }

    const preset = await pipelineService.savePreset(req.teamId, req.params.projectId, { name, nodes, edges });
    res.status(201).json(preset);
  } catch (error) {
    componentLogger.error('Failed to save preset', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to save preset' });
  }
}

export const pipelineController = {
  run,
  listPresets,
  savePreset,
};
