import { describe, it, expect } from 'vitest';
import {
  detectBlockType,
  parseTextToBlocks,
  normalizeBlockText,
  getLiveTypeConversion,
  reformatBlockAsType,
  extractCharacterNames,
  cycleBlockType,
  exportBlocksToText,
  reconcileBlockIds,
  insertBlockAfter,
  updateBlockText,
  changeBlockType,
  removeBlock,
} from '../services/parser.js';

describe('detectBlockType', () => {
  it('should detect scene heading', () => {
    expect(detectBlockType(['INT. OFFICE - DAY'], 0, null)).toBe('scene_heading');
    expect(detectBlockType(['EXT. PARK - NIGHT'], 0, null)).toBe('scene_heading');
  });

  it('should detect Russian scene heading', () => {
    expect(detectBlockType(['ИНТ. ОФИС - ДЕНЬ'], 0, null)).toBe('scene_heading');
  });

  it('should detect transition', () => {
    expect(detectBlockType(['CUT TO:'], 0, null)).toBe('transition');
    expect(detectBlockType(['FADE OUT.'], 0, null)).toBe('transition');
  });

  it('should detect character (ALL CAPS after blank/action)', () => {
    expect(detectBlockType(['', 'JOHN'], 1, 'action')).toBe('character');
  });

  it('should detect dialogue after character', () => {
    expect(detectBlockType(['Hello there!'], 0, 'character')).toBe('dialogue');
  });

  it('should detect parenthetical in dialogue context', () => {
    expect(detectBlockType(['(whispering)'], 0, 'character')).toBe('parenthetical');
  });

  it('should detect action by default', () => {
    expect(detectBlockType(['He walks across the room.'], 0, null)).toBe('action');
  });

  it('should detect section tag as scene_heading', () => {
    expect(detectBlockType(['[INTRO]'], 0, null)).toBe('scene_heading');
  });

  it('should detect voice hint as character', () => {
    expect(detectBlockType(['ГОЛОС: Привет мир'], 0, null)).toBe('character');
  });
});

describe('parseTextToBlocks', () => {
  it('should parse a simple screenplay', () => {
    const text = `INT. OFFICE - DAY

John enters the room.

JOHN
Hello, how are you?

JANE
(smiling)
I'm fine, thanks.`;

    const blocks = parseTextToBlocks(text);

    expect(blocks[0].type).toBe('scene_heading');
    expect(blocks[0].text).toBe('INT. OFFICE - DAY');
    expect(blocks[1].type).toBe('action');
    expect(blocks[2].type).toBe('character');
    expect(blocks[2].text).toBe('JOHN');
    expect(blocks[3].type).toBe('dialogue');
    expect(blocks[4].type).toBe('character');
    expect(blocks[5].type).toBe('parenthetical');
    expect(blocks[6].type).toBe('dialogue');
  });

  it('should handle universal format [SECTION]', () => {
    const text = `[INTRO - 5 sec]
ГОЛОС: Welcome to our show`;

    const blocks = parseTextToBlocks(text);

    expect(blocks[0].type).toBe('scene_heading');
    expect(blocks[0].text).toBe('INTRO');
    expect(blocks[1].type).toBe('character');
    expect(blocks[1].text).toBe('ГОЛОС');
    expect(blocks[2].type).toBe('dialogue');
    expect(blocks[2].text).toBe('Welcome to our show');
  });

  it('should generate unique block IDs', () => {
    const blocks = parseTextToBlocks('INT. OFFICE\nAction line');
    const ids = blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('normalizeBlockText', () => {
  it('should uppercase scene headings', () => {
    expect(normalizeBlockText({ type: 'scene_heading', text: 'int. office' })).toBe('INT. OFFICE');
  });

  it('should uppercase character names', () => {
    expect(normalizeBlockText({ type: 'character', text: 'john' })).toBe('JOHN');
  });

  it('should preserve action text', () => {
    expect(normalizeBlockText({ type: 'action', text: 'Mixed Case' })).toBe('Mixed Case');
  });
});

describe('getLiveTypeConversion', () => {
  it('should detect int. prefix in action block', () => {
    expect(getLiveTypeConversion({ type: 'action', text: 'int. office' })).toBe('scene_heading');
  });

  it('should return null for non-action blocks', () => {
    expect(getLiveTypeConversion({ type: 'dialogue', text: 'int. office' })).toBeNull();
  });

  it('should return null for non-matching text', () => {
    expect(getLiveTypeConversion({ type: 'action', text: 'hello world' })).toBeNull();
  });
});

describe('reformatBlockAsType', () => {
  it('should add INT. prefix for scene heading', () => {
    expect(reformatBlockAsType('office day', 'scene_heading')).toBe('INT. OFFICE DAY');
  });

  it('should wrap in parentheses for parenthetical', () => {
    expect(reformatBlockAsType('whispering', 'parenthetical')).toBe('(whispering)');
  });

  it('should uppercase for character', () => {
    expect(reformatBlockAsType('john', 'character')).toBe('JOHN');
  });
});

describe('extractCharacterNames', () => {
  it('should extract unique character names', () => {
    const blocks = [
      { type: 'character', text: 'JOHN' },
      { type: 'dialogue', text: 'Hello' },
      { type: 'character', text: 'JANE (V.O.)' },
      { type: 'character', text: 'JOHN' },
    ];
    const names = extractCharacterNames(blocks);
    expect(names).toEqual(['JANE', 'JOHN']);
  });
});

describe('cycleBlockType', () => {
  it('should cycle forward', () => {
    expect(cycleBlockType('action')).toBe('scene_heading');
    expect(cycleBlockType('shot')).toBe('action');
  });

  it('should cycle backward', () => {
    expect(cycleBlockType('action', true)).toBe('shot');
  });
});

describe('exportBlocksToText', () => {
  it('should format blocks with proper indentation', () => {
    const blocks = [
      { type: 'scene_heading', text: 'INT. OFFICE - DAY' },
      { type: 'action', text: 'John enters.' },
      { type: 'character', text: 'JOHN' },
      { type: 'dialogue', text: 'Hello.' },
    ];
    const text = exportBlocksToText(blocks);
    expect(text).toContain('INT. OFFICE - DAY');
    expect(text).toContain('John enters.');
    expect(text).toContain('JOHN');
    expect(text).toContain('Hello.');
  });
});

describe('reconcileBlockIds', () => {
  it('should preserve old IDs for matching blocks', () => {
    const old = [{ id: 'old-1', type: 'action', text: 'Same text' }];
    const fresh = [{ id: 'new-1', type: 'action', text: 'Same text' }];
    const result = reconcileBlockIds(old, fresh);
    expect(result[0].id).toBe('old-1');
  });

  it('should keep new IDs when no match', () => {
    const old = [{ id: 'old-1', type: 'action', text: 'Old text' }];
    const fresh = [{ id: 'new-1', type: 'scene_heading', text: 'Different' }];
    const result = reconcileBlockIds(old, fresh);
    expect(result[0].id).toBe('new-1');
  });

  it('should return newBlocks as-is when oldBlocks is empty', () => {
    const result = reconcileBlockIds([], [{ id: 'x', type: 'action', text: 'test' }]);
    expect(result[0].id).toBe('x');
  });
});

describe('block operations', () => {
  const blocks = [
    { id: 'a', type: 'scene_heading', text: 'INT. OFFICE' },
    { id: 'b', type: 'action', text: 'Action.' },
    { id: 'c', type: 'character', text: 'JOHN' },
  ];

  it('insertBlockAfter', () => {
    const result = insertBlockAfter(blocks, 'a', { id: 'x', type: 'action', text: 'New' });
    expect(result).toHaveLength(4);
    expect(result[1].id).toBe('x');
  });

  it('updateBlockText', () => {
    const result = updateBlockText(blocks, 'b', 'Updated.');
    expect(result[1].text).toBe('Updated.');
  });

  it('changeBlockType', () => {
    const result = changeBlockType(blocks, 'b', 'character');
    expect(result[1].type).toBe('character');
    expect(result[1].text).toBe('ACTION.');
  });

  it('removeBlock', () => {
    const result = removeBlock(blocks, 'b');
    expect(result).toHaveLength(2);
    expect(result.find((b) => b.id === 'b')).toBeUndefined();
  });
});
