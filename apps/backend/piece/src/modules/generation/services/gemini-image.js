import { getGoogleClient } from '../../ai/services/providers.js';
import { createComponentLogger } from '../../../utils/logger.js';

const componentLogger = createComponentLogger('GeminiImage');

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

export async function generateImage({ prompt, referenceImages = [], aspectRatio = '16:9' }) {
  const client = await getGoogleClient();
  if (!client) throw new Error('Google API key not configured');

  const contents = [];

  for (const ref of referenceImages.slice(0, 8)) {
    contents.push({ inlineData: { mimeType: 'image/jpeg', data: ref } });
  }

  contents.push({ text: prompt });

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ role: 'user', parts: contents }],
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
          aspectRatio,
        },
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (p) => p.inlineData?.mimeType?.startsWith('image/'),
      );

      if (imagePart) {
        componentLogger.info('Image generated', { aspectRatio, attempt });
        return {
          b64: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType,
          provider: 'google',
        };
      }

      lastError = new Error('No image in response');
    } catch (error) {
      lastError = error;
      componentLogger.warn('Generation attempt failed', { attempt, error: error.message });
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_MS * (attempt + 1)));
      }
    }
  }

  throw lastError;
}
