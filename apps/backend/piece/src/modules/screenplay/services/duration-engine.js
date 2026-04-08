export const DIALOGUE_WPM = 155;
export const ACTION_WPM = 120;
export const HEADING_MS = 1500;
export const TRANSITION_MS = 1000;
export const DIALOGUE_PAUSE_MS = 300;
export const MIN_BLOCK_MS = 500;
export const MIN_ACTION_MS = 1500;
export const MAX_ACTION_MS = 8000;
export const PARENTHETICAL_MS = 500;
export const CHARACTER_BEAT_MS = 200;
export const MIN_SCENE_MS = 3000;

export function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function dialogueDurationMs(text) {
  return Math.max(
    MIN_BLOCK_MS,
    Math.round((wordCount(text) / DIALOGUE_WPM) * 60_000) + DIALOGUE_PAUSE_MS,
  );
}

export function actionDurationMs(text) {
  return Math.max(
    MIN_ACTION_MS,
    Math.min(MAX_ACTION_MS, Math.round((wordCount(text) / ACTION_WPM) * 60_000)),
  );
}

export function estimateBlockDurationMs(type, text) {
  const words = wordCount(text);
  if (words === 0 && type !== 'scene_heading' && type !== 'transition') return 0;

  switch (type) {
    case 'scene_heading':
      return HEADING_MS;
    case 'dialogue':
      return dialogueDurationMs(text);
    case 'parenthetical':
      return PARENTHETICAL_MS;
    case 'character':
      return CHARACTER_BEAT_MS;
    case 'transition':
      return TRANSITION_MS;
    case 'action':
    case 'shot':
    default:
      return actionDurationMs(text);
  }
}

export function getEffectiveDuration(entry) {
  return entry.displayDurationMs ?? entry.manualDurationMs ?? entry.estimatedDurationMs;
}

export function computeGapMs(entry) {
  const effective = getEffectiveDuration(entry);
  if (entry.mediaDurationMs === null || entry.mediaDurationMs === undefined) return 0;
  return Math.max(0, effective - entry.mediaDurationMs);
}
