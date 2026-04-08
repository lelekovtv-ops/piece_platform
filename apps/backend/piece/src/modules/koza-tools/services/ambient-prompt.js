import { config } from '../../../config.js';
import { createComponentLogger } from '../../../utils/logger.js';

const componentLogger = createComponentLogger('AmbientPrompt');

const SYSTEM_PROMPT = 'You are a cinematic storyboard prompt engineer. Given a shot description, produce a single improved DALL-E image prompt (max 180 words). Output ONLY the prompt text, no explanation.';

export async function enhancePrompt({ description }) {
  const apiKey = config.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const { generateText } = await import('ai');
  const { createAnthropic } = await import('@ai-sdk/anthropic');

  const anthropic = createAnthropic({ apiKey });

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: SYSTEM_PROMPT,
    prompt: description,
  });

  componentLogger.info('Prompt enhanced');
  return { prompt: text.trim() };
}
