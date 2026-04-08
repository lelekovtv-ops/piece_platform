export const RUNDOWN_ENTRY_TYPES = Object.freeze({
  ESTABLISHING: 'establishing',
  ACTION: 'action',
  DIALOGUE: 'dialogue',
  TRANSITION: 'transition',
  HEADING: 'heading',
});

export const RUNDOWN_ENTRY_TYPE_VALUES = Object.freeze(
  Object.values(RUNDOWN_ENTRY_TYPES),
);

let _entryIdCounter = 0;

export function makeRundownEntryId() {
  _entryIdCounter += 1;
  return `rde_${Date.now()}_${_entryIdCounter}`;
}

export function createRundownEntry(partial = {}) {
  return {
    id: partial.id ?? makeRundownEntryId(),
    parentBlockId: partial.parentBlockId,
    parentEntryId: partial.parentEntryId ?? null,
    order: partial.order ?? 0,
    label: partial.label ?? '',
    caption: partial.caption ?? '',
    sourceText: partial.sourceText ?? '',
    entryType: partial.entryType,
    estimatedDurationMs: partial.estimatedDurationMs ?? 0,
    manualDurationMs: partial.manualDurationMs ?? null,
    mediaDurationMs: partial.mediaDurationMs ?? null,
    displayDurationMs: partial.displayDurationMs ?? null,
    visual: partial.visual ?? null,
    modifier: partial.modifier ?? null,
    shotSize: partial.shotSize ?? '',
    cameraMotion: partial.cameraMotion ?? '',
    directorNote: partial.directorNote ?? '',
    cameraNote: partial.cameraNote ?? '',
    imagePrompt: partial.imagePrompt ?? '',
    videoPrompt: partial.videoPrompt ?? '',
    visualDescription: partial.visualDescription ?? '',
    speaker: partial.speaker ?? null,
    voiceClipId: partial.voiceClipId ?? null,
    isVO: partial.isVO ?? false,
    locked: partial.locked ?? false,
    autoSynced: partial.autoSynced ?? true,
    generationHistory: partial.generationHistory ?? [],
    activeHistoryIndex: partial.activeHistoryIndex ?? null,
  };
}
