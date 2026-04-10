import { config } from '../../../config.js';

let anthropicClient = null;
let openaiClient = null;
let googleClient = null;

export async function getAnthropicClient() {
  if (anthropicClient) return anthropicClient;
  const apiKey = config.get('ANTHROPIC_API_KEY');
  if (!apiKey) return null;

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

export async function getOpenAIClient() {
  if (openaiClient) return openaiClient;
  const apiKey = config.get('OPENAI_API_KEY');
  if (!apiKey) return null;

  const { default: OpenAI } = await import('openai');
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export async function getGoogleClient() {
  if (googleClient) return googleClient;
  const apiKey = config.get('GOOGLE_API_KEY');
  if (!apiKey) return null;

  const { GoogleGenAI } = await import('@google/genai');
  googleClient = new GoogleGenAI({ apiKey });
  return googleClient;
}

export function getConfiguredProviders() {
  return {
    anthropic: Boolean(config.get('ANTHROPIC_API_KEY')),
    openai: Boolean(config.get('OPENAI_API_KEY')),
    google: Boolean(config.get('GOOGLE_API_KEY')),
  };
}

export const DEFAULT_MODELS = Object.freeze({
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  google: 'gemini-2.5-flash-lite',
});

export async function chatCompletion({ provider, model, messages, systemPrompt, temperature = 0.7, maxTokens = 4096 }) {
  switch (provider) {
    case 'anthropic': {
      const client = await getAnthropicClient();
      if (!client) throw new Error('Anthropic API key not configured');

      const response = await client.messages.create({
        model: model || DEFAULT_MODELS.anthropic,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt || undefined,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      return {
        content: response.content.map((c) => c.text).join(''),
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
        provider: 'anthropic',
        model: response.model,
      };
    }

    case 'openai': {
      const client = await getOpenAIClient();
      if (!client) throw new Error('OpenAI API key not configured');

      const allMessages = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages;

      const response = await client.chat.completions.create({
        model: model || DEFAULT_MODELS.openai,
        messages: allMessages,
        temperature,
        max_tokens: maxTokens,
      });

      return {
        content: response.choices[0]?.message?.content || '',
        usage: { inputTokens: response.usage?.prompt_tokens, outputTokens: response.usage?.completion_tokens },
        provider: 'openai',
        model: response.model,
      };
    }

    case 'google': {
      const client = await getGoogleClient();
      if (!client) throw new Error('Google API key not configured');

      const genModel = client.models;
      const response = await genModel.generateContent({
        model: model || DEFAULT_MODELS.google,
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        config: {
          temperature,
          maxOutputTokens: maxTokens,
          systemInstruction: systemPrompt || undefined,
        },
      });

      return {
        content: response.text || '',
        usage: { inputTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount },
        provider: 'google',
        model: model || DEFAULT_MODELS.google,
      };
    }

    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export async function streamChatCompletion({ provider, model, messages, systemPrompt, temperature = 0.7, maxTokens = 4096, onChunk }) {
  switch (provider) {
    case 'anthropic': {
      const client = await getAnthropicClient();
      if (!client) throw new Error('Anthropic API key not configured');

      const stream = client.messages.stream({
        model: model || DEFAULT_MODELS.anthropic,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt || undefined,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.text) {
          onChunk(event.delta.text);
        }
      }

      const finalMessage = await stream.finalMessage();
      return {
        usage: { inputTokens: finalMessage.usage.input_tokens, outputTokens: finalMessage.usage.output_tokens },
        provider: 'anthropic',
      };
    }

    case 'openai': {
      const client = await getOpenAIClient();
      if (!client) throw new Error('OpenAI API key not configured');

      const allMessages = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages;

      const stream = await client.chat.completions.create({
        model: model || DEFAULT_MODELS.openai,
        messages: allMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) onChunk(delta);
      }

      return { provider: 'openai' };
    }

    case 'google': {
      const client = await getGoogleClient();
      if (!client) throw new Error('Google API key not configured');

      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const response = await client.models.generateContentStream({
        model: model || DEFAULT_MODELS.google,
        contents,
        config: {
          temperature,
          maxOutputTokens: maxTokens,
          systemInstruction: systemPrompt || undefined,
        },
      });

      for await (const chunk of response) {
        const text = chunk.text;
        if (text) onChunk(text);
      }

      return { provider: 'google' };
    }

    default:
      throw new Error(`Streaming not supported for provider: ${provider}`);
  }
}
