import { translate } from './service.js';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('TranslateController');

async function translateText(req, res) {
  try {
    const { text, to, from } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'text is required' });
    }

    const result = await translate(text, { to, from });
    res.json(result);
  } catch (error) {
    componentLogger.error('Translation failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Translation failed' });
  }
}

export const translateController = {
  translateText,
};
