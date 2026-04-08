import { describe, it, expect } from 'vitest';
import {
  SCREENPLAY_ELEMENT_TYPES,
  SCREENPLAY_ELEMENT_TYPE_VALUES,
  DURATION_SOURCES,
  DEFAULT_FLOW,
  CYCLE_ORDER,
  generateBlockId,
  createScreenplayElement,
} from '../screenplay.js';

describe('SCREENPLAY_ELEMENT_TYPES', () => {
  it('should contain all 7 standard block types', () => {
    expect(Object.keys(SCREENPLAY_ELEMENT_TYPES)).toHaveLength(7);
    expect(SCREENPLAY_ELEMENT_TYPES.SCENE_HEADING).toBe('scene_heading');
    expect(SCREENPLAY_ELEMENT_TYPES.DIALOGUE).toBe('dialogue');
    expect(SCREENPLAY_ELEMENT_TYPES.SHOT).toBe('shot');
  });

  it('should be frozen', () => {
    expect(Object.isFrozen(SCREENPLAY_ELEMENT_TYPES)).toBe(true);
  });
});

describe('SCREENPLAY_ELEMENT_TYPE_VALUES', () => {
  it('should contain all values', () => {
    expect(SCREENPLAY_ELEMENT_TYPE_VALUES).toHaveLength(7);
    expect(SCREENPLAY_ELEMENT_TYPE_VALUES).toContain('scene_heading');
    expect(SCREENPLAY_ELEMENT_TYPE_VALUES).toContain('action');
  });
});

describe('DURATION_SOURCES', () => {
  it('should contain auto, manual, media', () => {
    expect(DURATION_SOURCES.AUTO).toBe('auto');
    expect(DURATION_SOURCES.MANUAL).toBe('manual');
    expect(DURATION_SOURCES.MEDIA).toBe('media');
  });
});

describe('DEFAULT_FLOW', () => {
  it('should define flow for all element types', () => {
    expect(DEFAULT_FLOW.afterSceneHeading).toBe('action');
    expect(DEFAULT_FLOW.afterCharacter).toBe('dialogue');
    expect(DEFAULT_FLOW.afterDialogue).toBe('character');
  });
});

describe('CYCLE_ORDER', () => {
  it('should contain all element types in cycle order', () => {
    expect(CYCLE_ORDER).toHaveLength(7);
    expect(CYCLE_ORDER[0]).toBe('action');
  });
});

describe('generateBlockId', () => {
  it('should return a string starting with blk_', () => {
    const id = generateBlockId();
    expect(id).toMatch(/^blk_\d+_\d+$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateBlockId()));
    expect(ids.size).toBe(100);
  });
});

describe('createScreenplayElement', () => {
  it('should create element with required fields', () => {
    const element = createScreenplayElement({
      type: 'action',
      text: 'The door opens.',
    });

    expect(element.id).toMatch(/^blk_/);
    expect(element.type).toBe('action');
    expect(element.text).toBe('The door opens.');
  });

  it('should use provided id when given', () => {
    const element = createScreenplayElement({
      id: 'custom-id',
      type: 'scene_heading',
    });

    expect(element.id).toBe('custom-id');
  });

  it('should default optional fields', () => {
    const element = createScreenplayElement({ type: 'action' });

    expect(element.text).toBe('');
    expect(element.durationMs).toBeNull();
    expect(element.durationSrc).toBeNull();
    expect(element.meta).toEqual({});
    expect(element.order).toBe(0);
  });

  it('should default type to action when no type provided', () => {
    const element = createScreenplayElement();
    expect(element.type).toBe('action');
  });
});
