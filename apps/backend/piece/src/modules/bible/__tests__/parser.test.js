import { describe, it, expect } from 'vitest';
import { extractBibleFromBlocks } from '../services/parser.js';

describe('extractBibleFromBlocks', () => {
  it('should extract character names from blocks', () => {
    const blocks = [
      { type: 'scene_heading', text: 'INT. OFFICE - DAY' },
      { type: 'character', text: 'JOHN' },
      { type: 'dialogue', text: 'Hello.' },
      { type: 'character', text: 'JANE (V.O.)' },
      { type: 'dialogue', text: 'Hi there.' },
      { type: 'character', text: 'JOHN' },
      { type: 'dialogue', text: 'How are you?' },
    ];

    const result = extractBibleFromBlocks(blocks);

    expect(result.characters).toHaveLength(2);
    expect(result.characters.map((c) => c.name)).toEqual(['JANE', 'JOHN']);
    expect(result.characters[0].description).toBe('');
    expect(result.characters[0].imageUrl).toBeNull();
  });

  it('should extract locations from scene headings', () => {
    const blocks = [
      { type: 'scene_heading', text: 'INT. OFFICE - DAY' },
      { type: 'action', text: 'Something happens.' },
      { type: 'scene_heading', text: 'EXT. PARK - NIGHT' },
      { type: 'action', text: 'More action.' },
      { type: 'scene_heading', text: 'INT. OFFICE - NIGHT' },
    ];

    const result = extractBibleFromBlocks(blocks);

    expect(result.locations).toHaveLength(2);
    expect(result.locations[0].name).toBe('OFFICE');
    expect(result.locations[0].intExt).toBe('INT');
    expect(result.locations[1].name).toBe('PARK');
    expect(result.locations[1].intExt).toBe('EXT');
  });

  it('should handle Russian scene headings', () => {
    const blocks = [
      { type: 'scene_heading', text: 'ИНТ. КВАРТИРА - ДЕНЬ' },
      { type: 'scene_heading', text: 'ЭКСТ. УЛИЦА - НОЧЬ' },
    ];

    const result = extractBibleFromBlocks(blocks);

    expect(result.locations).toHaveLength(2);
    expect(result.locations[0].name).toBe('КВАРТИРА');
    expect(result.locations[0].intExt).toBe('INT');
    expect(result.locations[1].name).toBe('УЛИЦА');
    expect(result.locations[1].intExt).toBe('EXT');
  });

  it('should return empty arrays for empty blocks', () => {
    const result = extractBibleFromBlocks([]);
    expect(result.characters).toEqual([]);
    expect(result.locations).toEqual([]);
    expect(result.props).toEqual([]);
  });

  it('should deduplicate locations', () => {
    const blocks = [
      { type: 'scene_heading', text: 'INT. OFFICE - DAY' },
      { type: 'scene_heading', text: 'INT. OFFICE - NIGHT' },
      { type: 'scene_heading', text: 'INT. OFFICE - MORNING' },
    ];

    const result = extractBibleFromBlocks(blocks);
    expect(result.locations).toHaveLength(1);
    expect(result.locations[0].name).toBe('OFFICE');
  });
});
