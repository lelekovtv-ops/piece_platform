import { describe, it, expect } from 'vitest';
import {
  getChildren,
  getTopLevel,
  hasChildren,
  getEffectiveEntries,
  flattenForTimeline,
  getTotalDuration,
  getEntryAtTime,
  recalculateParentDurations,
} from '../services/hierarchy.js';

const makeEntry = (overrides) => ({
  id: 'e1',
  parentBlockId: 'b1',
  parentEntryId: null,
  order: 0,
  entryType: 'action',
  estimatedDurationMs: 2000,
  manualDurationMs: null,
  mediaDurationMs: null,
  displayDurationMs: null,
  label: 'Shot 1',
  caption: 'Action text',
  speaker: null,
  isVO: false,
  visual: null,
  ...overrides,
});

describe('getTopLevel', () => {
  it('should return entries without parent', () => {
    const entries = [
      makeEntry({ id: 'a', parentEntryId: null, order: 1 }),
      makeEntry({ id: 'b', parentEntryId: 'a', order: 0 }),
      makeEntry({ id: 'c', parentEntryId: null, order: 0 }),
    ];
    const top = getTopLevel(entries);
    expect(top).toHaveLength(2);
    expect(top[0].id).toBe('c');
    expect(top[1].id).toBe('a');
  });
});

describe('getChildren', () => {
  it('should return children sorted by order', () => {
    const entries = [
      makeEntry({ id: 'parent', parentEntryId: null }),
      makeEntry({ id: 'c2', parentEntryId: 'parent', order: 2 }),
      makeEntry({ id: 'c1', parentEntryId: 'parent', order: 1 }),
    ];
    const children = getChildren(entries, 'parent');
    expect(children).toHaveLength(2);
    expect(children[0].id).toBe('c1');
  });
});

describe('hasChildren', () => {
  it('should return true when children exist', () => {
    const entries = [
      makeEntry({ id: 'p' }),
      makeEntry({ id: 'c', parentEntryId: 'p' }),
    ];
    expect(hasChildren(entries, 'p')).toBe(true);
    expect(hasChildren(entries, 'c')).toBe(false);
  });
});

describe('getEffectiveEntries', () => {
  it('should replace headings with their children', () => {
    const entries = [
      makeEntry({ id: 'heading', entryType: 'heading', parentEntryId: null, order: 0 }),
      makeEntry({ id: 'child1', parentEntryId: 'heading', order: 0, estimatedDurationMs: 1000 }),
      makeEntry({ id: 'child2', parentEntryId: 'heading', order: 1, estimatedDurationMs: 2000 }),
      makeEntry({ id: 'leaf', parentEntryId: null, order: 1, estimatedDurationMs: 3000 }),
    ];
    const effective = getEffectiveEntries(entries);
    expect(effective).toHaveLength(3);
    expect(effective[0].id).toBe('child1');
    expect(effective[1].id).toBe('child2');
    expect(effective[2].id).toBe('leaf');
  });
});

describe('flattenForTimeline', () => {
  it('should produce positions with absolute start times', () => {
    const entries = [
      makeEntry({ id: 'e1', order: 0, estimatedDurationMs: 2000 }),
      makeEntry({ id: 'e2', order: 1, estimatedDurationMs: 3000 }),
    ];
    const positions = flattenForTimeline(entries);
    expect(positions).toHaveLength(2);
    expect(positions[0].startMs).toBe(0);
    expect(positions[0].endMs).toBe(2000);
    expect(positions[1].startMs).toBe(2000);
    expect(positions[1].endMs).toBe(5000);
  });

  it('should add voice and titles tracks for dialogue', () => {
    const entries = [
      makeEntry({ id: 'e1', entryType: 'dialogue', speaker: 'JOHN', estimatedDurationMs: 2000 }),
    ];
    const positions = flattenForTimeline(entries);
    expect(positions).toHaveLength(3);
    expect(positions.map((p) => p.track)).toEqual(['visual', 'voice', 'titles']);
  });
});

describe('getTotalDuration', () => {
  it('should sum effective durations', () => {
    const entries = [
      makeEntry({ id: 'e1', estimatedDurationMs: 2000 }),
      makeEntry({ id: 'e2', estimatedDurationMs: 3000, order: 1 }),
    ];
    expect(getTotalDuration(entries)).toBe(5000);
  });
});

describe('getEntryAtTime', () => {
  it('should find entry at a specific time', () => {
    const entries = [
      makeEntry({ id: 'e1', estimatedDurationMs: 2000, order: 0 }),
      makeEntry({ id: 'e2', estimatedDurationMs: 3000, order: 1 }),
    ];
    expect(getEntryAtTime(entries, 0).id).toBe('e1');
    expect(getEntryAtTime(entries, 1999).id).toBe('e1');
    expect(getEntryAtTime(entries, 2000).id).toBe('e2');
    expect(getEntryAtTime(entries, 10000)).toBeNull();
  });
});

describe('recalculateParentDurations', () => {
  it('should sum children durations for heading entries', () => {
    const entries = [
      makeEntry({ id: 'h1', entryType: 'heading', estimatedDurationMs: 0 }),
      makeEntry({ id: 'c1', parentEntryId: 'h1', estimatedDurationMs: 1000 }),
      makeEntry({ id: 'c2', parentEntryId: 'h1', estimatedDurationMs: 2000 }),
    ];
    const result = recalculateParentDurations(entries);
    expect(result[0].estimatedDurationMs).toBe(3000);
  });
});
