import { getOpenAIClient } from '../../ai/services/providers.js';
import { createComponentLogger } from '../../../utils/logger.js';

const componentLogger = createComponentLogger('OpenAIImage');

export async function generateImage({ prompt, referenceImages = [], size = '1536x1024', quality = 'medium' }) {
  const client = await getOpenAIClient();
  if (!client) throw new Error('OpenAI API key not configured');

  if (referenceImages.length > 0) {
    try {
      const result = await generateWithReferences(client, { prompt, referenceImages, size, quality });
      return result;
    } catch (error) {
      componentLogger.warn('Reference-based generation failed, falling back to prompt-only', {
        error: error.message,
      });
    }
  }

  const response = await client.images.generate({
    model: 'gpt-image-1',
    prompt,
    n: 1,
    size,
    quality,
  });

  const imageData = response.data[0];
  componentLogger.info('Image generated', { size, quality });

  return {
    url: imageData.url || null,
    b64: imageData.b64_json || null,
    mimeType: 'image/png',
    revisedPrompt: imageData.revised_prompt || prompt,
    provider: 'openai',
  };
}

async function generateWithReferences(client, { prompt, referenceImages, size, quality }) {
  const input = [
    ...referenceImages.map((url) => ({
      type: 'input_image',
      input_image: { url, detail: 'low' },
    })),
    { type: 'text', text: prompt },
  ];

  const response = await client.images.edit({
    model: 'gpt-image-1',
    input,
    size,
    quality,
  });

  return {
    url: response.data[0]?.url || null,
    b64: response.data[0]?.b64_json || null,
    revisedPrompt: prompt,
    provider: 'openai',
  };
}
