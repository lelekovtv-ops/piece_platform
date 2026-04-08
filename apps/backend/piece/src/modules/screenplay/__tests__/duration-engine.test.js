import { describe, it, expect } from 'vitest';
import {
  wordCount,
  dialogueDurationMs,
  actionDurationMs,
  estimateBlockDurationMs,
  getEffectiveDuration,
  computeGapMs,
  DIALOGUE_WPM,
  MIN_BLOCK_MS,
  MIN_ACTION_MS,
  HEADING_MS,
  TRANSITION_MS,
  PARENTHETICAL_MS,
  CHARACTER_BEAT_MS,
} from '../services/duration-engine.js';

describe('wordCount', () => {
  it('should count words correctly', () => {
    expect(wordCount('hello world')).toBe(2);
    expect(wordCount('  one  two  three  ')).toBe(3);
    expect(wordCount('')).toBe(0);
  });
});

describe('dialogueDurationMs', () => {
  it('should calculate based on WPM', () => {
    const text = Array(DIALOGUE_WPM).fill('word').join(' ');
    const duration = dialogueDurationMs(text);
    expect(duration).toBeGreaterThan(59000);
    expect(duration).toBeLessThan(62000);
  });

  it('should enforce minimum', () => {
    expect(dialogueDurationMs('hi')).toBeGreaterThanOrEqual(MIN_BLOCK_MS);
  });
});

describe('actionDurationMs', () => {
  it('should enforce minimum', () => {
    expect(actionDurationMs('short')).toBe(MIN_ACTION_MS);
  });

  it('should calculate based on WPM for longer text', () => {
    const longText = Array(100).fill('word').join(' ');
    const duration = actionDurationMs(longText);
    expect(duration).toBeGreaterThan(MIN_ACTION_MS);
  });
});

describe('estimateBlockDurationMs', () => {
  it('should return HEADING_MS for scene_heading', () => {
    expect(estimateBlockDurationMs('scene_heading', 'INT. OFFICE')).toBe(HEADING_MS);
  });

  it('should return TRANSITION_MS for transition', () => {
    expect(estimateBlockDurationMs('transition', 'CUT TO:')).toBe(TRANSITION_MS);
  });

  it('should return PARENTHETICAL_MS for parenthetical', () => {
    expect(estimateBlockDurationMs('parenthetical', '(beat)')).toBe(PARENTHETICAL_MS);
  });

  it('should return CHARACTER_BEAT_MS for character', () => {
    expect(estimateBlockDurationMs('character', 'JOHN')).toBe(CHARACTER_BEAT_MS);
  });

  it('should return 0 for empty non-heading blocks', () => {
    expect(estimateBlockDurationMs('action', '')).toBe(0);
    expect(estimateBlockDurationMs('dialogue', '')).toBe(0);
  });
});

describe('getEffectiveDuration', () => {
  it('should use displayDurationMs first', () => {
    expect(getEffectiveDuration({
      estimatedDurationMs: 1000,
      manualDurationMs: 2000,
      displayDurationMs: 3000,
    })).toBe(3000);
  });

  it('should fallback to manualDurationMs', () => {
    expect(getEffectiveDuration({
      estimatedDurationMs: 1000,
      manualDurationMs: 2000,
    })).toBe(2000);
  });

  it('should fallback to estimatedDurationMs', () => {
    expect(getEffectiveDuration({ estimatedDurationMs: 1000 })).toBe(1000);
  });
});

describe('computeGapMs', () => {
  it('should return 0 when no media duration', () => {
    expect(computeGapMs({ estimatedDurationMs: 1000 })).toBe(0);
  });

  it('should compute gap when media is shorter', () => {
    expect(computeGapMs({
      estimatedDurationMs: 5000,
      mediaDurationMs: 3000,
    })).toBe(2000);
  });

  it('should return 0 when media is longer', () => {
    expect(computeGapMs({
      estimatedDurationMs: 3000,
      mediaDurationMs: 5000,
    })).toBe(0);
  });
});
