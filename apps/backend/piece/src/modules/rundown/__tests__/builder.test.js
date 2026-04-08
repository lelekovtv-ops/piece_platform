import { describe, it, expect } from 'vitest';
import {
  simpleHash,
  snapshotBlocks,
  diffBlockSnapshots,
  buildRundownEntries,
  reconcileRundownEntries,
} from '../services/builder.js';

describe('simpleHash', () => {
  it('should return consistent hash for same input', () => {
    expect(simpleHash('hello')).toBe(simpleHash('hello'));
  });

  it('should return different hashes for different input', () => {
    expect(simpleHash('hello')).not.toBe(simpleHash('world'));
  });
});

describe('snapshotBlocks', () => {
  it('should create snapshots with text hashes', () => {
    const blocks = [
      { id: 'a', type: 'action', text: 'He walks.' },
      { id: 'b', type: 'dialogue', text: 'Hello.' },
    ];
    const snapshots = snapshotBlocks(blocks);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].id).toBe('a');
    expect(typeof snapshots[0].textHash).toBe('number');
  });
});

describe('diffBlockSnapshots', () => {
  it('should detect added blocks', () => {
    const prev = [{ id: 'a', type: 'action', textHash: 1 }];
    const next = [
      { id: 'a', type: 'action', textHash: 1 },
      { id: 'b', type: 'action', textHash: 2 },
    ];
    const diff = diffBlockSnapshots(prev, next);
    expect(diff.addedBlockIds).toEqual(['b']);
    expect(diff.hasStructuralChanges).toBe(true);
  });

  it('should detect removed blocks', () => {
    const prev = [{ id: 'a', type: 'action', textHash: 1 }];
    const next = [];
    const diff = diffBlockSnapshots(prev, next);
    expect(diff.removedBlockIds).toEqual(['a']);
  });

  it('should detect text changes', () => {
    const prev = [{ id: 'a', type: 'action', textHash: 1 }];
    const next = [{ id: 'a', type: 'action', textHash: 2 }];
    const diff = diffBlockSnapshots(prev, next);
    expect(diff.textChangedBlockIds).toEqual(['a']);
    expect(diff.hasStructuralChanges).toBe(false);
  });

  it('should detect type changes', () => {
    const prev = [{ id: 'a', type: 'action', textHash: 1 }];
    const next = [{ id: 'a', type: 'dialogue', textHash: 1 }];
    const diff = diffBlockSnapshots(prev, next);
    expect(diff.typeChangedBlockIds).toEqual(['a']);
    expect(diff.hasStructuralChanges).toBe(true);
  });
});

describe('buildRundownEntries', () => {
  const scenes = [{ id: 'scene-1', blockIds: ['h1', 'a1', 'c1', 'd1'], title: 'OFFICE' }];

  it('should create establishing entry for first action in scene', () => {
    const blocks = [
      { id: 'h1', type: 'scene_heading', text: 'INT. OFFICE - DAY' },
      { id: 'a1', type: 'action', text: 'John enters the room and sits down.' },
    ];
    const entries = buildRundownEntries(blocks, scenes);
    expect(entries).toHaveLength(1);
    expect(entries[0].entryType).toBe('establishing');
    expect(entries[0].parentBlockId).toBe('a1');
  });

  it('should create dialogue entry for character+dialogue', () => {
    const blocks = [
      { id: 'h1', type: 'scene_heading', text: 'INT. OFFICE' },
      { id: 'a1', type: 'action', text: 'John enters.' },
      { id: 'c1', type: 'character', text: 'JOHN' },
      { id: 'd1', type: 'dialogue', text: 'Hello there, how are you today?' },
    ];
    const entries = buildRundownEntries(blocks, scenes);
    expect(entries).toHaveLength(2);
    expect(entries[1].entryType).toBe('dialogue');
    expect(entries[1].speaker).toBe('JOHN');
    expect(entries[1].caption).toBe('Hello there, how are you today?');
  });

  it('should detect V.O.', () => {
    const blocks = [
      { id: 'h1', type: 'scene_heading', text: 'INT. ROOM' },
      { id: 'c1', type: 'character', text: 'NARRATOR (V.O.)' },
      { id: 'd1', type: 'dialogue', text: 'Once upon a time.' },
    ];
    const entries = buildRundownEntries(blocks, [{ id: 's1', blockIds: ['h1', 'c1', 'd1'], title: 'ROOM' }]);
    expect(entries[0].isVO).toBe(true);
  });

  it('should create transition entry', () => {
    const blocks = [
      { id: 't1', type: 'transition', text: 'CUT TO:' },
    ];
    const entries = buildRundownEntries(blocks, []);
    expect(entries).toHaveLength(1);
    expect(entries[0].entryType).toBe('transition');
  });

  it('should return empty for empty blocks', () => {
    expect(buildRundownEntries([], [])).toEqual([]);
  });
});

describe('reconcileRundownEntries', () => {
  it('should preserve locked entries', () => {
    const existing = [
      { id: 'e1', parentBlockId: 'a1', locked: true, autoSynced: false, order: 0, visual: { thumbnailUrl: 'img.jpg' }, parentEntryId: null },
    ];
    const newEntries = [
      { id: 'n1', parentBlockId: 'a2', entryType: 'action', order: 0, label: 'Shot 1', caption: 'New', sourceText: 'New', estimatedDurationMs: 1500, speaker: null, isVO: false, parentEntryId: null },
    ];
    const result = reconcileRundownEntries(newEntries, existing);
    expect(result.find((e) => e.id === 'e1')).toBeDefined();
  });

  it('should merge matching entries by parentBlockId', () => {
    const existing = [
      { id: 'e1', parentBlockId: 'a1', autoSynced: true, locked: false, order: 0, visual: { thumbnailUrl: 'old.jpg' }, imagePrompt: 'old prompt', parentEntryId: null },
    ];
    const newEntries = [
      { id: 'n1', parentBlockId: 'a1', entryType: 'action', order: 0, label: 'New Label', caption: 'New caption', sourceText: 'New', estimatedDurationMs: 2000, speaker: null, isVO: false, parentEntryId: null },
    ];
    const result = reconcileRundownEntries(newEntries, existing);
    expect(result[0].id).toBe('e1');
    expect(result[0].label).toBe('New Label');
    expect(result[0].visual.thumbnailUrl).toBe('old.jpg');
  });
});
