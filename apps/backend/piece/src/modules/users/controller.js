import { userService } from './service.js';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('UserController');

async function list(req, res) {
  try {
    const { limit = 20, offset = 0, search } = req.query;
    const result = await userService.list({
      limit: Number(limit),
      offset: Number(offset),
      search,
    });
    res.json(result);
  } catch (error) {
    componentLogger.error('Failed to list users', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list users' });
  }
}

async function getProfile(req, res) {
  try {
    const userId = req.user.id;
    const user = await userService.getById(userId);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    componentLogger.error('Failed to get profile', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get profile' });
  }
}

async function getById(req, res) {
  try {
    const user = await userService.getById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    componentLogger.error('Failed to get user', { error: error.message, id: req.params.id });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get user' });
  }
}

async function update(req, res) {
  try {
    const user = await userService.update(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    componentLogger.error('Failed to update user', { error: error.message, id: req.params.id });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update user' });
  }
}

async function remove(req, res) {
  try {
    const deleted = await userService.remove(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }
    res.status(204).send();
  } catch (error) {
    componentLogger.error('Failed to delete user', { error: error.message, id: req.params.id });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete user' });
  }
}

export const userController = {
  list,
  getProfile,
  getById,
  update,
  remove,
};
