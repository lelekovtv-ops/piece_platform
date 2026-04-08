import { teamService } from './service.js';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('TeamController');

async function create(req, res) {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Team name is required',
      });
    }

    const team = await teamService.create({ name: name.trim(), ownerId: req.user.id });
    res.status(201).json(team);
  } catch (error) {
    componentLogger.error('Failed to create team', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create team' });
  }
}

async function list(req, res) {
  try {
    const teams = await teamService.listByUser(req.user.id);
    res.json({ data: teams });
  } catch (error) {
    componentLogger.error('Failed to list teams', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list teams' });
  }
}

async function getById(req, res) {
  try {
    const team = await teamService.getById(req.params.teamId);
    if (!team) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Team not found' });
    }
    res.json(team);
  } catch (error) {
    componentLogger.error('Failed to get team', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get team' });
  }
}

async function update(req, res) {
  try {
    const team = await teamService.update(req.params.teamId, req.body);
    if (!team) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Team not found' });
    }
    res.json(team);
  } catch (error) {
    componentLogger.error('Failed to update team', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update team' });
  }
}

async function addMember(req, res) {
  try {
    const { userId, role } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'userId is required',
      });
    }

    const member = await teamService.addMember(req.params.teamId, userId, role);
    res.status(201).json(member);
  } catch (error) {
    if (error.code === 'ALREADY_MEMBER') {
      return res.status(409).json({ error: 'CONFLICT', message: error.message });
    }
    componentLogger.error('Failed to add member', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to add member' });
  }
}

async function removeMember(req, res) {
  try {
    const removed = await teamService.removeMember(req.params.teamId, req.params.userId);
    if (!removed) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Member not found' });
    }
    res.status(204).send();
  } catch (error) {
    componentLogger.error('Failed to remove member', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to remove member' });
  }
}

async function getMembers(req, res) {
  try {
    const members = await teamService.getMembers(req.params.teamId);
    res.json({ data: members });
  } catch (error) {
    componentLogger.error('Failed to get members', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get members' });
  }
}

export const teamController = {
  create,
  list,
  getById,
  update,
  addMember,
  removeMember,
  getMembers,
};
