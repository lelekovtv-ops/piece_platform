import { chatCompletion, streamChatCompletion, getConfiguredProviders } from './services/providers.js';
import { splitVision } from './services/vision-splitter.js';
import { enhancePrompt } from './services/prompt-enhancer.js';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('AIController');

async function chat(req, res) {
  try {
    const { messages, provider = 'anthropic', model, systemPrompt, temperature, stream = false } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'messages array is required' });
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      await streamChatCompletion({
        provider,
        model,
        messages,
        systemPrompt,
        temperature,
        onChunk: (text) => {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        },
      });

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const result = await chatCompletion({ provider, model, messages, systemPrompt, temperature });
      res.json(result);
    }
  } catch (error) {
    componentLogger.error('Chat failed', { error: error.message });
    if (!res.headersSent) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
  }
}

async function visionSplit(req, res) {
  try {
    const { text, provider, model } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'text is required' });
    }

    const result = await splitVision(text, { provider, model });
    res.json(result);
  } catch (error) {
    componentLogger.error('Vision split failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to split vision' });
  }
}

async function promptEnhance(req, res) {
  try {
    const { text, provider, model } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'text is required' });
    }

    const enhanced = await enhancePrompt(text, { provider, model });
    res.json({ enhanced });
  } catch (error) {
    componentLogger.error('Prompt enhance failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to enhance prompt' });
  }
}

function capabilities(_req, res) {
  const providers = getConfiguredProviders();
  res.json({
    anthropicConfigured: providers.anthropic,
    openaiConfigured: providers.openai,
    googleConfigured: providers.google,
  });
}

export const aiController = {
  chat,
  visionSplit,
  promptEnhance,
  capabilities,
};
