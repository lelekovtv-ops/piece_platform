import { chatCompletion } from './providers.js';

const SYSTEM_PROMPT = `You are a visual prompt engineer for AI image generation (DALL-E, Midjourney, Flux).
Given a shot description from a screenplay, improve it into a high-quality image generation prompt.

Rules:
- Maximum 180 words
- Focus on visual details: composition, lighting, color palette, atmosphere
- Include camera angle and framing
- Remove any brand names or copyrighted character references
- Describe the scene as if directing a cinematographer
- Use present tense, descriptive language
- Preserve the input language`;

export async function enhancePrompt(text, { provider = 'anthropic', model } = {}) {
  const response = await chatCompletion({
    provider,
    model,
    messages: [{ role: 'user', content: `Enhance this shot description for image generation:\n\n${text}` }],
    systemPrompt: SYSTEM_PROMPT,
    temperature: 0.7,
    maxTokens: 512,
  });

  return response.content.trim();
}
