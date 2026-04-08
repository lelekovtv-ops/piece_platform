import { chatCompletion } from './providers.js';

const SYSTEM_PROMPT = `You are a director's vision parser for a cinematic production pipeline.
Given a freeform director's note, split it into structured storyboard fields.

Return ONLY a JSON object with these exact fields:
{
  "action": "Observable behavior and staging (1-3 sentences, present tense)",
  "director": "Emotional intent, atmosphere, subtext (1-2 sentences)",
  "camera": "Shot size, lens, movement, lighting (technical specs)"
}

Rules:
- ACTION: What the audience SEES happening. Physical actions, blocking, staging.
- DIRECTOR: What the audience should FEEL. Mood, tone, emotional beats.
- CAMERA: How we SHOOT it. Technical camera decisions.
- Preserve the input language (don't translate).
- If a field has no relevant content, use empty string.`;

export async function splitVision(text, { provider = 'anthropic', model } = {}) {
  const response = await chatCompletion({
    provider,
    model,
    messages: [{ role: 'user', content: text }],
    systemPrompt: SYSTEM_PROMPT,
    temperature: 0.3,
    maxTokens: 1024,
  });

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { action: text, director: '', camera: '' };
    return JSON.parse(jsonMatch[0]);
  } catch {
    return { action: text, director: '', camera: '' };
  }
}
