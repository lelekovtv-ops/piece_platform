import { config } from '../../../config.js';
import { createComponentLogger } from '../../../utils/logger.js';
import { chatCompletion } from '../../ai/services/providers.js';

const componentLogger = createComponentLogger('AmbientPrompt');

const SYSTEM_PROMPT = 'You are a cinematic storyboard prompt engineer. Given a shot description, produce a single improved image prompt (max 180 words). Output ONLY the prompt text, no explanation.';

export async function enhancePrompt({ description }) {
  const apiKey = config.get('GOOGLE_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_API_KEY not configured');

  const result = await chatCompletion({
    provider: 'google',
    messages: [{ role: 'user', content: description }],
    systemPrompt: SYSTEM_PROMPT,
    temperature: 0.7,
    maxTokens: 500,
  });

  componentLogger.info('Prompt enhanced');
  return { prompt: result.content.trim() };
}
