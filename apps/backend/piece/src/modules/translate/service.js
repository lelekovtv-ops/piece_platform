import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('TranslateService');

export async function translate(text, { to = 'en', from } = {}) {
  try {
    const { default: translateFn } = await import('google-translate-api-x');
    const result = await translateFn(text, { to, from: from || undefined });
    return {
      text: result.text,
      from: result.from?.language?.iso || from || 'auto',
      to,
    };
  } catch (error) {
    componentLogger.error('Translation failed', { error: error.message });
    throw error;
  }
}
