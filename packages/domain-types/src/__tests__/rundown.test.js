import { describe, it, expect } from 'vitest';
import {
  RUNDOWN_ENTRY_TYPES,
  RUNDOWN_ENTRY_TYPE_VALUES,
  makeRundownEntryId,
  createRundownEntry,
} from '../rundown.js';

describe('RUNDOWN_ENTRY_TYPES', () => {
  it('should contain all 5 entry types', () => {
    expect(Object.keys(RUNDOWN_ENTRY_TYPES)).toHaveLength(5);
    expect(RUNDOWN_ENTRY_TYPES.ESTABLISHING).toBe('establishing');
    expect(RUNDOWN_ENTRY_TYPES.ACTION).toBe('action');
    expect(RUNDOWN_ENTRY_TYPES.DIALOGUE).toBe('dialogue');
    expect(RUNDOWN_ENTRY_TYPES.TRANSITION).toBe('transition');
    expect(RUNDOWN_ENTRY_TYPES.HEADING).toBe('heading');
  });

  it('should be frozen', () => {
    expect(Object.isFrozen(RUNDOWN_ENTRY_TYPES)).toBe(true);
  });
});

describe('RUNDOWN_ENTRY_TYPE_VALUES', () => {
  it('should contain all values', () => {
    expect(RUNDOWN_ENTRY_TYPE_VALUES).toHaveLength(5);
    expect(RUNDOWN_ENTRY_TYPE_VALUES).toContain('establishing');
  });
});

describe('makeRundownEntryId', () => {
  it('should return a string starting with rde_', () => {
    const id = makeRundownEntryId();
    expect(id).toMatch(/^rde_\d+_\d+$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => makeRundownEntryId()));
    expect(ids.size).toBe(100);
  });
});

describe('createRundownEntry', () => {
  it('should create entry with required fields', () => {
    const entry = createRundownEntry({
      parentBlockId: 'blk_123',
      entryType: 'action',
    });

    expect(entry.id).toMatch(/^rde_/);
    expect(entry.parentBlockId).toBe('blk_123');
    expect(entry.entryType).toBe('action');
    expect(entry.parentEntryId).toBeNull();
    expect(entry.order).toBe(0);
  });

  it('should default all optional fields', () => {
    const entry = createRundownEntry({
      parentBlockId: 'blk_1',
      entryType: 'dialogue',
    });

    expect(entry.visual).toBeNull();
    expect(entry.modifier).toBeNull();
    expect(entry.speaker).toBeNull();
    expect(entry.voiceClipId).toBeNull();
    expect(entry.isVO).toBe(false);
    expect(entry.locked).toBe(false);
    expect(entry.autoSynced).toBe(true);
    expect(entry.generationHistory).toEqual([]);
    expect(entry.activeHistoryIndex).toBeNull();
    expect(entry.estimatedDurationMs).toBe(0);
    expect(entry.shotSize).toBe('');
    expect(entry.cameraMotion).toBe('');
    expect(entry.imagePrompt).toBe('');
  });

  it('should accept partial overrides', () => {
    const entry = createRundownEntry({
      id: 'custom-rde',
      parentBlockId: 'blk_1',
      entryType: 'establishing',
      shotSize: 'WS',
      cameraMotion: 'dolly_in',
      locked: true,
    });

    expect(entry.id).toBe('custom-rde');
    expect(entry.shotSize).toBe('WS');
    expect(entry.cameraMotion).toBe('dolly_in');
    expect(entry.locked).toBe(true);
  });

  it('should support sub-shot hierarchy via parentEntryId', () => {
    const entry = createRundownEntry({
      parentBlockId: 'blk_1',
      parentEntryId: 'rde_parent',
      entryType: 'action',
    });

    expect(entry.parentEntryId).toBe('rde_parent');
  });
});
