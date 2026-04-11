import { config } from '../../../config.js';
import { createComponentLogger } from '../../../utils/logger.js';

const componentLogger = createComponentLogger('AmbientImage');

export async function generateAmbientImage({ prompt }) {
  const apiKey = config.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const { experimental_generateImage: generateImage } = await import('ai');
  const { createOpenAI } = await import('@ai-sdk/openai');

  const openai = createOpenAI({ apiKey });

  const { image } = await generateImage({
    model: openai.image('dall-e-3'),
    prompt,
    size: '1792x1024',
  });

  componentLogger.info('Ambient image generated');

  return {
    buffer: Buffer.from(image.base64, 'base64'),
    mimeType: 'image/png',
  };
}
