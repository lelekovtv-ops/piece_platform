import { config } from '../../../config.js';
import { createComponentLogger } from '../../../utils/logger.js';

const componentLogger = createComponentLogger('AmbientImage');

export async function generateAmbientImage({ prompt }) {
  const apiKey = config.get('GOOGLE_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_API_KEY not configured');

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: prompt,
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig: { aspectRatio: '16:9' },
    },
  });

  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.mimeType?.startsWith('image/'),
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error('No image in Gemini response');
  }

  componentLogger.info('Ambient image generated');

  return {
    buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  };
}
