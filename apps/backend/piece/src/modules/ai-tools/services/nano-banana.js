import { config } from '../../../config.js';
import { createComponentLogger } from '../../../utils/logger.js';

const componentLogger = createComponentLogger('NanoBanana');

const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 3000;

function parseDataUrl(dataUrl) {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1 || !dataUrl.startsWith('data:')) return null;

  const header = dataUrl.slice(5, commaIndex);
  const base64Marker = ';base64';
  if (!header.endsWith(base64Marker)) return null;

  const mimeType = header.slice(0, -base64Marker.length);
  const data = dataUrl.slice(commaIndex + 1);

  return { inlineData: { mimeType, data } };
}

export async function generateNanoBanana({ prompt, referenceImages, stylePrompt }) {
  const apiKey = config.get('GOOGLE_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_API_KEY not configured');

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const finalPrompt = stylePrompt && typeof stylePrompt === 'string'
    ? `${prompt.replace(/\s*16:9\.\s*No text[^.]*\.?\s*$/i, '').trim()}\nStyle: ${stylePrompt}. 16:9. No text, no watermark.`
    : prompt;

  const imageReferenceParts = Array.isArray(referenceImages)
    ? referenceImages
      .filter((entry) => typeof entry === 'string' && entry.startsWith('data:'))
      .slice(0, 8)
      .map(parseDataUrl)
      .filter(Boolean)
    : [];

  const contents = [finalPrompt, ...imageReferenceParts];

  let lastError = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents,
        config: {
          responseModalities: ['image'],
          imageConfig: { aspectRatio: '16:9' },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      const imagePart = parts?.find((part) => part.inlineData?.mimeType?.startsWith('image/'));

      if (imagePart?.inlineData?.data) {
        componentLogger.info('Image generated', { attempt });
        return {
          buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
          mimeType: imagePart.inlineData.mimeType || 'image/png',
        };
      }

      const textPart = parts?.find((part) => part.text);
      throw new Error(textPart?.text || 'Model returned no image parts');
    } catch (error) {
      lastError = error;
      const isRetryable = /503|UNAVAILABLE|overloaded|high demand/i.test(error.message);
      if (isRetryable && attempt < MAX_ATTEMPTS - 1) {
        const delay = (attempt + 1) * RETRY_BASE_MS;
        componentLogger.warn('Retry attempt', { attempt: attempt + 1, delay, error: error.message });
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      break;
    }
  }

  throw lastError;
}
