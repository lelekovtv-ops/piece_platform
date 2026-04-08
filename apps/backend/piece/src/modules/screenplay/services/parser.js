import { generateBlockId } from '@piece/domain-types/screenplay';

const RE_SCENE_HEADING = /^(INT\.\s*\/\s*EXT\.\s*|EXT\.\s*\/\s*INT\.\s*|INT\.\s*|EXT\.\s*|I\/E\.\s*|ИНТ\.\s*\/\s*ЭКСТ\.\s*|ЭКСТ\.\s*\/\s*ИНТ\.\s*|ИНТ\.\s*|ЭКСТ\.\s*|EST\.\s*)/i;
const RE_TRANSITION = /^(FADE\s+(IN:?|OUT[.::]?|TO\s+BLACK:?)|CUT\s+TO:|SMASH\s+CUT\s+TO:|MATCH\s+CUT\s+TO:|DISSOLVE\s+TO:|WIPE\s+TO:|IRIS\s+(IN|OUT):?|JUMP\s+CUT\s+TO:|FREEZE\s+FRAME:?|ЗАТЕМНЕНИЕ:?|ПЕРЕХОД:?|НАПЛЫВ:?|ВЫТЕСНЕНИЕ:?|СТОП-КАДР:?)$|.*\s+TO:$/i;
const RE_SHOT = /^(INSERT|BACK\s+TO\s+SCENE|CLOSE\s+ON|CLOSE-UP|ANGLE\s+ON|POV|WIDE\s+ON|INTERCUT\s+WITH|SERIES\s+OF\s+SHOTS|КРУПНЫЙ\s+ПЛАН:?|КРУПНО:?|ДЕТАЛЬ:?|ОБЩИЙ\s+ПЛАН:?|СРЕДНИЙ\s+ПЛАН:?|ВСТАВКА:?|РАКУРС:?|ИНТЕРКАТ:?|ОБРАТНЫЙ\s+КАДР:?|СЕРИЯ\s+КАДРОВ:?):?$/i;
const RE_PARENTHETICAL = /^\(.*\)$/;
const RE_SECTION_TAG = /^\[(.+)\]\s*$/;
const RE_VOICE_HINT = /^(ГОЛОС|VOICE|NARRATOR|ВЕДУЩИЙ|СПИКЕР):\s*/i;
const RE_VISUAL_HINT = /^(ТИТР|TITLE|ГРАФИКА|GRAPHICS|B-ROLL|CTA):\s*/i;
const RE_MUSIC_HINT = /^(МУЗЫКА|MUSIC|SFX|ЗВУК):\s*/i;

export function detectBlockType(lines, index, prevType) {
  const raw = lines[index] ?? '';
  const trimmed = raw.trim();

  if (!trimmed) return 'action';

  if (RE_SECTION_TAG.test(trimmed)) return 'scene_heading';
  if (RE_VOICE_HINT.test(trimmed)) return 'character';
  if (RE_VISUAL_HINT.test(trimmed)) return 'action';
  if (RE_MUSIC_HINT.test(trimmed)) return 'action';
  if (RE_SCENE_HEADING.test(trimmed)) return 'scene_heading';

  if (trimmed.startsWith('.') && trimmed.length > 1 && !trimmed.startsWith('..'))
    return 'scene_heading';

  if (RE_TRANSITION.test(trimmed)) return 'transition';
  if (RE_SHOT.test(trimmed)) return 'shot';

  if (RE_PARENTHETICAL.test(trimmed)) {
    if (prevType === 'character' || prevType === 'parenthetical' || prevType === 'dialogue')
      return 'parenthetical';
    return 'action';
  }

  const stripped = trimmed
    .replace(/\s*\((V\.?O\.?|O\.?S\.?|O\.?C\.?|CONT'?D|ПРОД\.?)\)\s*$/i, '')
    .replace(/\s*\(\d+(?:\s*(?:лет|years?|г\.?))?\)\s*$/i, '');
  const isAllCaps =
    stripped === stripped.toUpperCase() &&
    stripped !== stripped.toLocaleLowerCase() &&
    stripped.length > 1 &&
    stripped.length < 52 &&
    /\p{Lu}/u.test(stripped) &&
    !RE_SCENE_HEADING.test(stripped) &&
    !RE_TRANSITION.test(trimmed);

  if (isAllCaps) {
    const prevLine = lines[index - 1]?.trim();
    const prevEmpty = !prevLine;
    if (prevEmpty || prevType === 'action' || prevType === 'transition' || prevType === 'scene_heading') {
      return 'character';
    }
  }

  if (prevType === 'character' || prevType === 'parenthetical' || prevType === 'dialogue') {
    if (prevType === 'dialogue') {
      const prevLine = (index > 0 ? lines[index - 1]?.trim() : '') ?? '';
      if (prevLine === '') {
        if (/^[A-ZА-ЯЁ][a-zа-яё]+\s+[a-zа-яё]/.test(trimmed)) return 'action';
        if (trimmed.length > 60) return 'action';
        if (/\b(поднимает|входит|выходит|садится|встаёт|берёт|смотрит|открывает|закрывает|поворачивается|уходит|стоит|идёт|бежит|reaches|picks up|enters|exits|sits|stands|walks|runs|looks|opens|closes|turns)\b/i.test(trimmed)) return 'action';
      }
    }
    return 'dialogue';
  }

  return 'action';
}

export function parseTextToBlocks(raw, initialPrevType = null) {
  const lines = raw.split('\n');
  const blocks = [];
  let prevType = initialPrevType;
  let blankCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      blankCount++;
      if (blankCount >= 2) {
        prevType = null;
      }
      continue;
    }

    blankCount = 0;
    const type = detectBlockType(lines, i, prevType);

    if (type === 'scene_heading' && RE_SECTION_TAG.test(trimmed)) {
      const inner = trimmed.match(RE_SECTION_TAG)[1];
      const title = inner.replace(/\s*[—\-–]\s*\d+\s*(сек|sec|с|s|мин|min|мін)\s*/i, '').trim();
      blocks.push({ id: generateBlockId(), type: 'scene_heading', text: title || inner });
      prevType = 'scene_heading';
      continue;
    }

    if (type === 'character' && RE_VOICE_HINT.test(trimmed)) {
      const hintMatch = trimmed.match(RE_VOICE_HINT);
      const speakerName = hintMatch[1].toUpperCase();
      const dialogueText = trimmed.slice(hintMatch[0].length).trim();

      blocks.push({ id: generateBlockId(), type: 'character', text: speakerName });
      prevType = 'character';

      if (dialogueText) {
        blocks.push({ id: generateBlockId(), type: 'dialogue', text: dialogueText });
        prevType = 'dialogue';
      }
      continue;
    }

    blocks.push({ id: generateBlockId(), type, text: trimmed });
    prevType = type;
  }

  return blocks;
}

export function normalizeBlockText(block) {
  switch (block.type) {
    case 'scene_heading':
    case 'character':
    case 'transition':
      return block.text.toUpperCase();
    default:
      return block.text;
  }
}

export function getLiveTypeConversion(block) {
  if (block.type !== 'action') return null;

  const t = block.text.trimStart().toLowerCase();
  const prefixes = [
    'int.', 'ext.', 'int./ext.', 'ext./int.', 'i/e.',
    'инт.', 'экст.', 'инт./экст.', 'экст./инт.',
  ];

  for (const prefix of prefixes) {
    if (t.startsWith(prefix)) return 'scene_heading';
  }

  return null;
}

function stripOuterParentheses(text) {
  const t = text.trim();
  if (t.startsWith('(') && t.endsWith(')') && t.length >= 2) {
    return t.slice(1, -1).trim();
  }
  return t;
}

export function reformatBlockAsType(text, targetType) {
  let clean = text.trim();
  if (clean.startsWith('.') && !clean.startsWith('..')) clean = clean.slice(1).trim();
  if (clean.startsWith('@')) clean = clean.slice(1).trim();
  if (clean.startsWith('>') && !clean.startsWith('>>')) clean = clean.slice(1).trim();
  clean = clean.replace(RE_SCENE_HEADING, '').trim() || clean;

  if (targetType !== 'parenthetical') {
    clean = stripOuterParentheses(clean);
  }

  switch (targetType) {
    case 'scene_heading': {
      const up = clean.toUpperCase();
      return RE_SCENE_HEADING.test(up) ? up : 'INT. ' + up;
    }
    case 'character':
      return clean.toUpperCase();
    case 'parenthetical':
      if (clean.startsWith('(') && clean.endsWith(')')) return clean;
      return `(${clean})`;
    case 'transition': {
      const up = clean.toUpperCase();
      return RE_TRANSITION.test(up) ? up : up + (up.endsWith(':') ? '' : ':');
    }
    default:
      return clean;
  }
}

export function extractCharacterNames(blocks) {
  const names = new Set();
  for (const block of blocks) {
    if (block.type === 'character' && block.text.trim().length > 1) {
      const clean = block.text.trim()
        .replace(/\s*\(\d+(?:\s*(?:лет|years?|г\.?))?\)\s*$/i, '')
        .replace(/\s*\(.*\)\s*$/, '')
        .trim();
      if (clean) names.add(clean);
    }
  }
  return Array.from(names).sort();
}

export function cycleBlockType(current, reverse = false) {
  const order = ['action', 'scene_heading', 'character', 'parenthetical', 'dialogue', 'transition', 'shot'];
  const idx = order.indexOf(current);
  if (idx === -1) return 'action';
  const next = reverse
    ? (idx - 1 + order.length) % order.length
    : (idx + 1) % order.length;
  return order[next];
}

const INDENT = {
  scene_heading: '',
  action: '',
  character: '                    ',
  parenthetical: '               ',
  dialogue: '          ',
  transition: '                                        ',
  shot: '',
};

export function exportBlocksToText(blocks) {
  const lines = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const prev = blocks[i - 1];

    const needsBlankBefore =
      block.type === 'scene_heading' ||
      block.type === 'transition' ||
      (block.type === 'character' && prev?.type !== 'parenthetical');

    if (i > 0 && needsBlankBefore) {
      lines.push('');
    }

    const indent = INDENT[block.type] || '';
    lines.push(indent + normalizeBlockText(block));

    if (block.type === 'scene_heading') {
      lines.push('');
    }
  }

  return lines.join('\n');
}

function bigramSimilarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) ?? 0) + 1);
  }

  let intersect = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const count = bigramsA.get(bg);
    if (count && count > 0) {
      intersect++;
      bigramsA.set(bg, count - 1);
    }
  }

  return (2 * intersect) / (a.length - 1 + b.length - 1);
}

export function reconcileBlockIds(oldBlocks, newBlocks) {
  if (oldBlocks.length === 0) return newBlocks;

  const oldById = new Map(oldBlocks.map((b) => [b.id, b]));
  const allMatch = newBlocks.every((b) => oldById.has(b.id));
  if (allMatch) return newBlocks;

  const oldByType = new Map();
  for (let i = 0; i < oldBlocks.length; i++) {
    const b = oldBlocks[i];
    const arr = oldByType.get(b.type) ?? [];
    arr.push({ block: b, idx: i, claimed: false });
    oldByType.set(b.type, arr);
  }

  const result = [];

  for (let ni = 0; ni < newBlocks.length; ni++) {
    const nb = newBlocks[ni];

    if (oldById.has(nb.id)) {
      result.push(nb);
      const candidates = oldByType.get(nb.type);
      const c = candidates?.find((c) => c.block.id === nb.id);
      if (c) c.claimed = true;
      continue;
    }

    const candidates = oldByType.get(nb.type);
    if (!candidates) {
      result.push(nb);
      continue;
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const c of candidates) {
      if (c.claimed) continue;

      const textA = c.block.text.trim();
      const textB = nb.text.trim();

      if (textA === textB) {
        const dist = Math.abs(c.idx - ni);
        const score = 1.0 - dist * 0.001;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = c;
        }
        continue;
      }

      if (textA.length > 3 && textB.length > 3) {
        const sim = bigramSimilarity(textA, textB);
        if (sim >= 0.85) {
          const dist = Math.abs(c.idx - ni);
          const score = sim - dist * 0.001;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = c;
          }
        }
      }
    }

    if (bestMatch) {
      bestMatch.claimed = true;
      result.push({ ...nb, id: bestMatch.block.id });
    } else {
      result.push(nb);
    }
  }

  return result;
}

export function insertBlockAfter(blocks, afterId, newBlock) {
  const idx = blocks.findIndex((b) => b.id === afterId);
  if (idx === -1) return [...blocks, newBlock];
  return [...blocks.slice(0, idx + 1), newBlock, ...blocks.slice(idx + 1)];
}

export function updateBlockText(blocks, id, text) {
  return blocks.map((b) => (b.id === id ? { ...b, text } : b));
}

export function changeBlockType(blocks, id, newType) {
  return blocks.map((b) => {
    if (b.id !== id) return b;
    return { ...b, type: newType, text: reformatBlockAsType(b.text, newType) };
  });
}

export function removeBlock(blocks, id) {
  return blocks.filter((b) => b.id !== id);
}
