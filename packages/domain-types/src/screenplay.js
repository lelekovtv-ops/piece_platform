export const SCREENPLAY_ELEMENT_TYPES = Object.freeze({
  SCENE_HEADING: 'scene_heading',
  ACTION: 'action',
  CHARACTER: 'character',
  PARENTHETICAL: 'parenthetical',
  DIALOGUE: 'dialogue',
  TRANSITION: 'transition',
  SHOT: 'shot',
});

export const SCREENPLAY_ELEMENT_TYPE_VALUES = Object.freeze(
  Object.values(SCREENPLAY_ELEMENT_TYPES),
);

export const DURATION_SOURCES = Object.freeze({
  AUTO: 'auto',
  MANUAL: 'manual',
  MEDIA: 'media',
});

export const DEFAULT_FLOW = Object.freeze({
  afterSceneHeading: SCREENPLAY_ELEMENT_TYPES.ACTION,
  afterAction: SCREENPLAY_ELEMENT_TYPES.ACTION,
  afterCharacter: SCREENPLAY_ELEMENT_TYPES.DIALOGUE,
  afterParenthetical: SCREENPLAY_ELEMENT_TYPES.DIALOGUE,
  afterDialogue: SCREENPLAY_ELEMENT_TYPES.CHARACTER,
  afterTransition: SCREENPLAY_ELEMENT_TYPES.ACTION,
  afterShot: SCREENPLAY_ELEMENT_TYPES.ACTION,
});

export const CYCLE_ORDER = Object.freeze([
  SCREENPLAY_ELEMENT_TYPES.ACTION,
  SCREENPLAY_ELEMENT_TYPES.SCENE_HEADING,
  SCREENPLAY_ELEMENT_TYPES.CHARACTER,
  SCREENPLAY_ELEMENT_TYPES.PARENTHETICAL,
  SCREENPLAY_ELEMENT_TYPES.DIALOGUE,
  SCREENPLAY_ELEMENT_TYPES.TRANSITION,
  SCREENPLAY_ELEMENT_TYPES.SHOT,
]);

let _blockIdCounter = 0;

export function generateBlockId() {
  _blockIdCounter += 1;
  return `blk_${Date.now()}_${_blockIdCounter}`;
}

export function createScreenplayElement(partial = {}) {
  return {
    id: partial.id ?? generateBlockId(),
    type: partial.type ?? SCREENPLAY_ELEMENT_TYPES.ACTION,
    text: partial.text ?? '',
    order: partial.order ?? 0,
    durationMs: partial.durationMs ?? null,
    durationSrc: partial.durationSrc ?? null,
    meta: partial.meta ?? {},
    createdAt: partial.createdAt ?? new Date(),
    updatedAt: partial.updatedAt ?? new Date(),
  };
}
