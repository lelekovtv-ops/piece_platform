import { settingsService } from './service.js';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('SettingsController');

async function getProjectSetting(req, res) {
  try {
    const data = await settingsService.getProjectSetting(req.teamId, req.params.projectId, req.params.key);
    if (data === null) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Setting not found' });
    }
    res.json({ data });
  } catch (error) {
    componentLogger.error('Failed to get project setting', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get setting' });
  }
}

async function setProjectSetting(req, res) {
  try {
    const { data } = req.body;
    if (data === undefined) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'data is required' });
    }
    const result = await settingsService.setProjectSetting(req.teamId, req.params.projectId, req.params.key, data);
    res.json({ data: result });
  } catch (error) {
    componentLogger.error('Failed to set project setting', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to save setting' });
  }
}

async function getUserSetting(req, res) {
  try {
    const data = await settingsService.getUserSetting(req.user.id, req.params.key);
    if (data === null) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Setting not found' });
    }
    res.json({ data });
  } catch (error) {
    componentLogger.error('Failed to get user setting', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get setting' });
  }
}

async function setUserSetting(req, res) {
  try {
    const { data } = req.body;
    if (data === undefined) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'data is required' });
    }
    const result = await settingsService.setUserSetting(req.user.id, req.params.key, data);
    res.json({ data: result });
  } catch (error) {
    componentLogger.error('Failed to set user setting', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to save setting' });
  }
}

export const settingsController = {
  getProjectSetting,
  setProjectSetting,
  getUserSetting,
  setUserSetting,
};
