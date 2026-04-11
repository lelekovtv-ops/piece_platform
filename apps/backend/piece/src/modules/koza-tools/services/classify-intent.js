import { config } from '../../../config.js';
import { createComponentLogger } from '../../../utils/logger.js';

const componentLogger = createComponentLogger('ClassifyIntent');

const DEFAULT_SYSTEM_PROMPT = `You classify user input into one of these intents. User is in a creative production app.

INTENTS:
- open_sessions — user wants to see/open/browse their sessions list
- new_session — user wants to create a new/fresh session
- open_script — open the script/screenplay panel
- open_timeline — open the timeline panel
- open_emotions — open the emotions/mood panel
- open_plan — open the production plan panel
- open_generator — open the image generator panel
- close_all — close all panels
- run_generation — run/start/launch generation pipeline
- smart_distribute — run smart distribution/analysis
- gesture_test — user wants to test hand gestures, enable gesture test mode, try gestures on a photo
- photo_search — user wants to search/find/browse photos, images, references, moodboard, visual materials from the internet
- chat — user is talking to AI, asking a question, or giving a creative instruction

Rules:
- If input is clearly a UI command (open/close/show/create something) -> pick the matching intent
- Handle typos, misspellings, transliteration errors VERY generously
- A single word that looks like a mangled version of a panel name -> pick that panel
- If input looks like a creative request, question, or greeting -> chat
- Respond with ONLY the intent name, nothing else`;

export async function classifyIntent({ input, system }) {
  const apiKey = config.get('ANTHROPIC_API_KEY');
  if (!apiKey) return 'chat';

  try {
    const { generateText } = await import('ai');
    const { createAnthropic } = await import('@ai-sdk/anthropic');

    const anthropic = createAnthropic({ apiKey });

    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: system || DEFAULT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: input }],
      temperature: 0,
    });

    const result = text.trim().toLowerCase().replace(/[^a-z_]/g, '');
    componentLogger.info('Intent classified', { input, result });
    return result;
  } catch (error) {
    componentLogger.error('Classification failed', { error: error.message });
    return 'chat';
  }
}
