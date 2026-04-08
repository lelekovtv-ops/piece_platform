export const GENERATION_CATEGORIES = Object.freeze({
  IMAGE: 'image',
  VIDEO: 'video',
  LIPSYNC: 'lipsync',
  MOTION: 'motion',
});

export const PROVIDER_NAMES = Object.freeze({
  OPENAI: 'openai',
  GOOGLE: 'google',
  SJINN: 'sjinn',
});

export const GENERATION_STATUSES = Object.freeze({
  QUEUED: 'queued',
  PROCESSING: 'processing',
  DONE: 'done',
  FAILED: 'failed',
});

export function createGenerationRequest(partial = {}) {
  return {
    model: partial.model ?? '',
    prompt: partial.prompt ?? '',
    referenceImages: partial.referenceImages ?? [],
    stylePrompt: partial.stylePrompt ?? '',
    sourceImageUrl: partial.sourceImageUrl ?? null,
    audioUrl: partial.audioUrl ?? null,
    aspectRatio: partial.aspectRatio ?? '16:9',
    motionVideoUrl: partial.motionVideoUrl ?? null,
  };
}

export function createGenerationResult(partial = {}) {
  return {
    type: partial.type ?? 'url',
    blob: partial.blob ?? null,
    url: partial.url ?? null,
    contentType: partial.contentType ?? 'image/png',
  };
}
