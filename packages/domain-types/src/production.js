export const CHANGE_ORIGINS = Object.freeze({
  SCREENPLAY: 'screenplay',
  STORYBOARD: 'storyboard',
  TIMELINE: 'timeline',
  VOICE: 'voice',
  CANVAS: 'canvas',
  SYSTEM: 'system',
  REMOTE: 'remote',
});

export const MODIFIER_TYPES = Object.freeze({
  DEFAULT: 'default',
  AI_AVATAR: 'ai-avatar',
  EFFECT: 'effect',
  B_ROLL: 'b-roll',
  TITLE_CARD: 'title-card',
  CANVAS: 'canvas',
});

export const VISUAL_TYPES = Object.freeze({
  IMAGE: 'image',
  VIDEO: 'video',
});

export function createProductionVisual(partial = {}) {
  return {
    thumbnailUrl: partial.thumbnailUrl ?? null,
    thumbnailBlobKey: partial.thumbnailBlobKey ?? null,
    originalUrl: partial.originalUrl ?? null,
    originalBlobKey: partial.originalBlobKey ?? null,
    imagePrompt: partial.imagePrompt ?? '',
    videoPrompt: partial.videoPrompt ?? '',
    shotSize: partial.shotSize ?? '',
    cameraMotion: partial.cameraMotion ?? '',
    generationHistory: partial.generationHistory ?? [],
    activeHistoryIndex: partial.activeHistoryIndex ?? null,
    type: partial.type ?? VISUAL_TYPES.IMAGE,
  };
}

export function createBlockModifier(partial = {}) {
  return {
    type: partial.type ?? MODIFIER_TYPES.DEFAULT,
    templateId: partial.templateId ?? null,
    canvasData: partial.canvasData ?? null,
    params: partial.params ?? {},
  };
}
