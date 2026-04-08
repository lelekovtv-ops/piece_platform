import { generateBlockId } from '@piece/domain-types/screenplay';

const FDX_TYPE_MAP = {
  'Scene Heading': 'scene_heading',
  'Action': 'action',
  'Character': 'character',
  'Parenthetical': 'parenthetical',
  'Dialogue': 'dialogue',
  'Transition': 'transition',
  'Shot': 'shot',
  'General': 'action',
};

function extractParagraphsRegex(xmlString) {
  const paragraphs = [];
  const paraRegex = /<Paragraph[^>]*Type="([^"]*)"[^>]*>([\s\S]*?)<\/Paragraph>/gi;
  let match;

  while ((match = paraRegex.exec(xmlString)) !== null) {
    const type = match[1];
    const innerXml = match[2];
    const textParts = [];
    const textRegex = /<Text[^>]*>([\s\S]*?)<\/Text>/gi;
    let textMatch;

    while ((textMatch = textRegex.exec(innerXml)) !== null) {
      textParts.push(textMatch[1]);
    }

    paragraphs.push({ type, text: textParts.join('') });
  }

  return paragraphs;
}

export function importFdx(xmlString) {
  const paragraphs = extractParagraphsRegex(xmlString);
  const blocks = [];

  for (const para of paragraphs) {
    const text = para.text.trim();
    if (!text) continue;

    const blockType = FDX_TYPE_MAP[para.type] || 'action';

    if (blockType === 'scene_heading' || blockType === 'character' || blockType === 'transition') {
      if (blocks.length > 0) {
        blocks.push({ id: generateBlockId(), type: blockType, text: text.toUpperCase() });
        continue;
      }
    }

    if (blockType === 'parenthetical') {
      const wrapped = text.startsWith('(') ? text : `(${text})`;
      blocks.push({ id: generateBlockId(), type: blockType, text: wrapped });
      continue;
    }

    blocks.push({ id: generateBlockId(), type: blockType, text });
  }

  return blocks;
}
