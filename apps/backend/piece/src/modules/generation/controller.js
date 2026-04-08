import { generateImage as generateOpenAI } from './services/openai-image.js';
import { generateImage as generateGemini } from './services/gemini-image.js';
import { searchImages } from './services/image-search.js';
import { config } from '../../config.js';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('GenerationController');

async function generate(req, res) {
  try {
    const { prompt, provider = 'openai', referenceImages, size, quality, aspectRatio } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'prompt is required' });
    }

    let result;
    switch (provider) {
      case 'openai':
        result = await generateOpenAI({ prompt, referenceImages, size, quality });
        break;
      case 'google':
        result = await generateGemini({ prompt, referenceImages, aspectRatio });
        break;
      default:
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: `Unknown provider: ${provider}` });
    }

    res.json(result);
  } catch (error) {
    componentLogger.error('Image generation failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
}

async function search(req, res) {
  try {
    const { query, perPage } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'query is required' });
    }

    const pexelsKey = config.get('PEXELS_API_KEY');
    const results = await searchImages(query, { apiKey: pexelsKey, perPage });
    res.json({ data: results });
  } catch (error) {
    componentLogger.error('Image search failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Image search failed' });
  }
}

export const generationController = {
  generate,
  search,
};
