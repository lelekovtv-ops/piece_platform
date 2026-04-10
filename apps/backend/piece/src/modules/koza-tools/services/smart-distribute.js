import { config } from '../../../config.js';
import { createComponentLogger } from '../../../utils/logger.js';
import { z } from 'zod';

const componentLogger = createComponentLogger('SmartDistribute');

const SYSTEM = `You are KOZA — an AI film director and production planner.

You receive a parsed script with sections and segments. Your job is to make SMART CREATIVE DECISIONS about how each piece should be produced.

For each segment you must decide:
- The best API/tool to generate it
- A detailed, cinematic production prompt (in English, regardless of script language)
- Camera/motion settings
- How it connects to adjacent segments (transitions, visual rhymes, tonal arc)

Think like David Fincher meets a YouTube producer: every frame has intent.

RULES:
- Voice segments -> TTS config (speed, emotion, pauses)
- Visual segments with "talking head" -> Video Gen with face consistency
- Visual segments with archive/photo references -> Image Gen with Ken Burns motion hint
- Visual segments with action/dynamic -> Video Gen with camera movement
- Titles -> animation style matching the mood (kinetic for energy, fade for drama)
- Music -> detailed mood description with BPM and instrument hints
- Think about the EMOTIONAL ARC across sections: hook should grab, middle should build, climax should peak, CTA should release
- Add SFX where they enhance impact (transitions, reveals, emphasis)
- Add transition hints between sections (cut, dissolve, whip-pan)

OUTPUT: Return an array of enriched jobs with creative decisions.`;

const JobSchema = z.object({
  segmentId: z.string(),
  type: z.enum(['tts', 'video-gen', 'image-gen', 'music-gen', 'sfx', 'title-card', 'lipsync']),
  prompt: z.string(),
  api: z.string(),
  camera: z.string().optional(),
  motionStrength: z.number().optional(),
  emotionalNote: z.string(),
  transitionTo: z.string().optional(),
  titleStyle: z.string().optional(),
  musicBpm: z.number().optional(),
  musicInstruments: z.string().optional(),
  voiceSpeed: z.number().optional(),
  voiceEmotion: z.string().optional(),
});

const ResponseSchema = z.object({
  directorNote: z.string(),
  colorGrade: z.string(),
  pacing: z.string(),
  jobs: z.array(JobSchema),
});

export async function smartDistribute({ segments, sections, scriptText }) {
  const apiKey = config.get('GOOGLE_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_API_KEY not configured');

  const { chatCompletion } = await import('../../ai/services/providers.js');

  const userPrompt = `Here is the script and its parsed structure. Make creative production decisions for each segment.

SCRIPT TEXT:
${scriptText}

SECTIONS:
${JSON.stringify(sections.map((s) => ({ id: s.id, title: s.title, order: s.order })), null, 2)}

SEGMENTS:
${JSON.stringify(segments.map((s) => ({
    id: s.id,
    role: s.role,
    track: s.track,
    content: s.content,
    startMs: s.startMs,
    durationMs: s.durationMs,
    sectionId: s.sectionId,
  })), null, 2)}

Analyze the emotional arc, decide on APIs, write cinematic prompts, choose camera moves.
Return ONLY valid JSON matching this schema (no markdown, no backticks):
{"directorNote":"...","colorGrade":"...","pacing":"...","jobs":[{"segmentId":"...","type":"tts|video-gen|image-gen|music-gen|sfx|title-card|lipsync","prompt":"...","api":"...","emotionalNote":"...","camera":"...","transitionTo":"..."}]}`;

  const response = await chatCompletion({
    provider: 'google',
    model: 'gemini-2.5-flash-lite',
    messages: [{ role: 'user', content: userPrompt }],
    systemPrompt: SYSTEM,
    temperature: 0.7,
    maxTokens: 8192,
  });

  const cleaned = response.content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in response');

  const parsed = JSON.parse(match[0]);
  const validated = ResponseSchema.parse(parsed);

  componentLogger.info('Smart distribution complete', { jobCount: validated.jobs.length });
  return validated;
}
