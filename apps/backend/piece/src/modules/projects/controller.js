import { projectService } from './service.js';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('ProjectController');

async function create(req, res) {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Project name is required',
      });
    }

    const project = await projectService.create(req.teamId, {
      name: name.trim(),
      description,
      ownerId: req.user.id,
    });
    res.status(201).json(project);
  } catch (error) {
    componentLogger.error('Failed to create project', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create project' });
  }
}

async function list(req, res) {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const result = await projectService.list(req.teamId, {
      limit: Number(limit),
      offset: Number(offset),
    });
    res.json(result);
  } catch (error) {
    componentLogger.error('Failed to list projects', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list projects' });
  }
}

async function getById(req, res) {
  try {
    const project = await projectService.getById(req.teamId, req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    componentLogger.error('Failed to get project', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get project' });
  }
}

async function update(req, res) {
  try {
    const project = await projectService.update(req.teamId, req.params.projectId, req.body);
    if (!project) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    componentLogger.error('Failed to update project', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update project' });
  }
}

async function remove(req, res) {
  try {
    const deleted = await projectService.remove(req.teamId, req.params.projectId);
    if (!deleted) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found' });
    }
    res.status(204).send();
  } catch (error) {
    componentLogger.error('Failed to delete project', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete project' });
  }
}

export const projectController = {
  create,
  list,
  getById,
  update,
  remove,
};
