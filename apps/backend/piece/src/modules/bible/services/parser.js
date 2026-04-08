import { extractCharacterNames } from '../../screenplay/services/parser.js';

const RE_SCENE_HEADING_LOCATION = /^(?:INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|I\/E\.|ИНТ\.|ЭКСТ\.|ИНТ\.\/ЭКСТ\.|ЭКСТ\.\/ИНТ\.)\s*(.+?)(?:\s*[-—–]\s*.+)?$/i;

function extractLocationsFromBlocks(blocks) {
  const locations = new Map();

  for (const block of blocks) {
    if (block.type !== 'scene_heading') continue;

    const match = block.text.match(RE_SCENE_HEADING_LOCATION);
    if (!match) continue;

    const rawLocation = match[1].trim().toUpperCase();
    if (!rawLocation) continue;

    if (!locations.has(rawLocation)) {
      const isExt = /^EXT\.|^ЭКСТ\./i.test(block.text);
      const isInt = /^INT\.|^ИНТ\./i.test(block.text);
      let intExt = 'INT';
      if (isExt && isInt) intExt = 'INT/EXT';
      else if (isExt) intExt = 'EXT';

      locations.set(rawLocation, {
        name: rawLocation,
        intExt,
        description: '',
        appearancePrompt: '',
      });
    }
  }

  return Array.from(locations.values());
}

export function extractBibleFromBlocks(blocks) {
  const characterNames = extractCharacterNames(blocks);

  const characters = characterNames.map((name) => ({
    name,
    description: '',
    appearancePrompt: '',
    ageRange: '',
    build: '',
    wardrobe: [],
    hairMakeup: '',
    palette: [],
    props: [],
    silhouette: '',
    continuityAnchors: [],
    imageUrl: null,
    imageBlobKey: null,
  }));

  const locations = extractLocationsFromBlocks(blocks);

  return { characters, locations, props: [] };
}
