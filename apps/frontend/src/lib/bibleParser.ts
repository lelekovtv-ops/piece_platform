import { type Block } from "@/lib/screenplayFormat";
import { type Scene } from "@/lib/sceneParser";

export interface BibleReferenceImage {
  id: string;
  url: string;
  blobKey: string;
  s3Key?: string;
  publicUrl?: string;
}

export type VoiceProvider =
  | "elevenlabs"
  | "fish-audio"
  | "web-speech"
  | "bark"
  | "custom";

// ─── Provider-Specific Settings ──────────────────────────────

export interface FishAudioSettings {
  speed: number; // prosody.speed, default 1.0
  volume: number; // prosody.volume in dB, default 0
  temperature: number; // 0–1, expressiveness, default 0.7
  topP: number; // 0–1, diversity, default 0.7
  emotion?: string; // bracket tag: "whisper", "angry", etc.
  format: "mp3" | "wav" | "opus"; // output format
  latency: "low" | "normal" | "balanced"; // speed/quality tradeoff
}

export interface ElevenLabsSettings {
  stability: number; // 0–1, default 0.5
  similarityBoost: number; // 0–1, default 0.75
  style: number; // 0–1, default 0.5
  useSpeakerBoost: boolean; // default true
  speed: number; // rate multiplier, default 1.0
}

export interface WebSpeechSettings {
  speed: number; // utterance.rate, 0.5–2.0
  pitch: number; // utterance.pitch, 0.5–2.0
}

export type ProviderSettings =
  | FishAudioSettings
  | ElevenLabsSettings
  | WebSpeechSettings;

export function createDefaultSettings(
  provider: VoiceProvider,
): ProviderSettings {
  switch (provider) {
    case "fish-audio":
      return {
        speed: 1.0,
        volume: 0,
        temperature: 0.7,
        topP: 0.7,
        format: "mp3",
        latency: "normal",
      } satisfies FishAudioSettings;
    case "elevenlabs":
      return {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0.5,
        useSpeakerBoost: true,
        speed: 1.0,
      } satisfies ElevenLabsSettings;
    case "web-speech":
    default:
      return {
        speed: 1.0,
        pitch: 1.0,
      } satisfies WebSpeechSettings;
  }
}

export function isFishAudioSettings(
  s: ProviderSettings,
): s is FishAudioSettings {
  return "temperature" in s && "topP" in s;
}

export function isElevenLabsSettings(
  s: ProviderSettings,
): s is ElevenLabsSettings {
  return "stability" in s && "similarityBoost" in s;
}

export function isWebSpeechSettings(
  s: ProviderSettings,
): s is WebSpeechSettings {
  return "pitch" in s && !("stability" in s) && !("temperature" in s);
}

// ─── Voice Config ────────────────────────────────────────────

export interface VoiceConfig {
  provider: VoiceProvider;
  voiceId: string;
  voiceName: string;
  previewUrl?: string;
  settings: ProviderSettings;
}

export type CharacterGender = "male" | "female" | "unknown";

export interface CharacterEntry {
  id: string;
  name: string;
  gender: CharacterGender;
  description: string;
  referenceImages: BibleReferenceImage[];
  canonicalImageId: string | null;
  generatedPortraitUrl: string | null;
  portraitBlobKey: string | null;
  portraitS3Key?: string;
  portraitPublicUrl?: string;
  appearancePrompt: string;
  sceneIds: string[];
  dialogueCount: number;
  voice?: VoiceConfig;
}

export interface LocationEntry {
  id: string;
  name: string;
  fullHeading: string;
  intExt: "INT" | "EXT" | "INT/EXT";
  timeOfDay: string;
  description: string;
  referenceImages: BibleReferenceImage[];
  canonicalImageId: string | null;
  generatedImageUrl: string | null;
  imageBlobKey: string | null;
  imageS3Key?: string;
  imagePublicUrl?: string;
  appearancePrompt: string;
  sceneIds: string[];
}

export interface PropEntry {
  id: string;
  name: string;
  description: string;
  sceneIds: string[];
  referenceImages: BibleReferenceImage[];
  canonicalImageId: string | null;
  generatedImageUrl: string | null;
  imageBlobKey: string | null;
  imageS3Key?: string;
  imagePublicUrl?: string;
  appearancePrompt: string;
}

type ParsedHeading = {
  name: string;
  fullHeading: string;
  intExt: "INT" | "EXT" | "INT/EXT";
  timeOfDay: string;
};

const CHARACTER_EXTENSION_RE = /\s*\((?:V\.?O\.?|O\.?S\.?|CONT'?D)\)\s*$/gi;
const INT_EXT_RE = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.?|EXT\.?|I\/E\.?)/i;
const HEADING_SPLIT_RE = /\s+[\-–—]+\s+/;

function normalizeCharacterName(text: string): string {
  return text
    .replace(CHARACTER_EXTENSION_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getSceneForBlockId(
  scenes: Scene[],
  blockId: string,
): Scene | undefined {
  return scenes.find((scene) => scene.blockIds.includes(blockId));
}

function parseSceneHeading(text: string): ParsedHeading | null {
  const fullHeading = text.trim();
  if (!fullHeading) return null;

  const prefixMatch = fullHeading.match(INT_EXT_RE);
  const rawPrefix = prefixMatch?.[0]?.toUpperCase().replace(/\./g, "") ?? "INT";

  let intExt: "INT" | "EXT" | "INT/EXT" = "INT";
  if (rawPrefix.includes("EXT") && rawPrefix.includes("INT")) {
    intExt = "INT/EXT";
  } else if (rawPrefix.includes("EXT")) {
    intExt = "EXT";
  }

  const withoutPrefix = fullHeading
    .replace(INT_EXT_RE, "")
    .trim()
    .replace(/^[\s.]+/, "");
  const parts = withoutPrefix
    .split(HEADING_SPLIT_RE)
    .map((part) => part.trim())
    .filter(Boolean);
  const timeOfDay = parts.length > 1 ? parts[parts.length - 1] : "";
  const name =
    (parts.length > 1 ? parts.slice(0, -1) : parts).join(" — ").trim() ||
    withoutPrefix;

  return {
    name,
    fullHeading,
    intExt,
    timeOfDay,
  };
}

export function slugify(text: string): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

export function parseCharacters(blocks: Block[]): CharacterEntry[] {
  const characters = new Map<string, CharacterEntry>();

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.type !== "character") continue;

    const name = normalizeCharacterName(block.text);
    if (!name) continue;

    // Filter out obvious non-characters (transitions, shots misclassified as character)
    const upper = name.toUpperCase();
    if (
      /^(FADE|CUT|DISSOLVE|WIPE|IRIS|SMASH|MATCH|JUMP|FREEZE|ЗАТЕМНЕНИЕ|ПЕРЕХОД|НАПЛЫВ|ВЫТЕСНЕНИЕ|СТОП)\b/.test(
        upper,
      )
    )
      continue;
    if (/\b(TO:|IN:|OUT[.:]?)$/.test(upper)) continue;

    const id = slugify(name);
    const existing = characters.get(id);
    let dialogueCount = existing?.dialogueCount ?? 0;

    for (let nextIndex = index + 1; nextIndex < blocks.length; nextIndex += 1) {
      const nextBlock = blocks[nextIndex];
      if (nextBlock.type === "parenthetical" || nextBlock.type === "dialogue") {
        dialogueCount += 1;
        continue;
      }
      break;
    }

    characters.set(id, {
      id,
      name,
      gender: existing?.gender ?? "unknown",
      description: existing?.description ?? "",
      referenceImages: existing?.referenceImages ?? [],
      canonicalImageId: existing?.canonicalImageId ?? null,
      generatedPortraitUrl: existing?.generatedPortraitUrl ?? null,
      portraitBlobKey: existing?.portraitBlobKey ?? null,
      appearancePrompt: existing?.appearancePrompt ?? "",
      sceneIds: [],
      dialogueCount,
    });
  }

  return Array.from(characters.values()).sort(
    (left, right) =>
      right.dialogueCount - left.dialogueCount ||
      left.name.localeCompare(right.name, "ru"),
  );
}

export function parseLocations(
  blocks: Block[],
  scenes: Scene[],
): LocationEntry[] {
  const locations = new Map<string, LocationEntry>();
  const scenesByHeadingBlockId = new Map(
    scenes.map((scene) => [scene.headingBlockId, scene]),
  );

  for (const block of blocks) {
    if (block.type !== "scene_heading") continue;

    const parsedHeading = parseSceneHeading(block.text);
    if (!parsedHeading?.name) continue;

    const id = slugify(parsedHeading.name);
    const scene =
      scenesByHeadingBlockId.get(block.id) ??
      getSceneForBlockId(scenes, block.id);
    const existing = locations.get(id);
    const nextSceneIds = uniqueStrings([
      ...(existing?.sceneIds ?? []),
      scene?.id ?? "",
    ]);

    locations.set(id, {
      id,
      name: parsedHeading.name,
      fullHeading: existing?.fullHeading || parsedHeading.fullHeading,
      intExt: existing?.intExt || parsedHeading.intExt,
      timeOfDay: existing?.timeOfDay || parsedHeading.timeOfDay,
      description: existing?.description ?? "",
      referenceImages: existing?.referenceImages ?? [],
      canonicalImageId: existing?.canonicalImageId ?? null,
      generatedImageUrl: existing?.generatedImageUrl ?? null,
      imageBlobKey: existing?.imageBlobKey ?? null,
      appearancePrompt: existing?.appearancePrompt ?? "",
      sceneIds: nextSceneIds,
    });
  }

  return Array.from(locations.values()).sort((left, right) =>
    left.name.localeCompare(right.name, "ru"),
  );
}

export function linkCharactersToScenes(
  characters: CharacterEntry[],
  blocks: Block[],
  scenes: Scene[],
): CharacterEntry[] {
  const sceneIdsByCharacterId = new Map<string, Set<string>>();

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.type !== "character") continue;

    const name = normalizeCharacterName(block.text);
    if (!name) continue;

    const characterId = slugify(name);
    let speaksInThisCue = false;

    for (let nextIndex = index + 1; nextIndex < blocks.length; nextIndex += 1) {
      const nextBlock = blocks[nextIndex];
      if (nextBlock.type === "parenthetical") {
        speaksInThisCue = true;
        continue;
      }
      if (nextBlock.type === "dialogue") {
        speaksInThisCue = true;
        continue;
      }
      break;
    }

    if (!speaksInThisCue) continue;

    const scene = getSceneForBlockId(scenes, block.id);
    if (!scene) continue;

    if (!sceneIdsByCharacterId.has(characterId)) {
      sceneIdsByCharacterId.set(characterId, new Set());
    }

    sceneIdsByCharacterId.get(characterId)?.add(scene.id);
  }

  return characters.map((character) => ({
    ...character,
    sceneIds: Array.from(sceneIdsByCharacterId.get(character.id) ?? []).sort(),
  }));
}

// ── Props Parser ──

/**
 * Ключевые слова-маркеры которые указывают на предмет взаимодействия в action-блоках.
 * Предметы выделяются из контекста действий: "берёт трубку", "смотрит на экран", "роняет стакан".
 */
const PROP_PATTERNS: Array<{
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => string;
}> = [
  // Транспорт
  {
    pattern:
      /(?:чёрн(?:ая|ый)|бел(?:ая|ый)|стар(?:ая|ый))?\s*(машин[аыу]|автомобил[ьяю]|авто|фургон|такси|мотоцикл)/gi,
    extract: (m) => m[1],
  },
  // Оружие
  {
    pattern: /(пистолет|нож|ружь[ёе]|револьвер|дробовик|винтовк[аиу])/gi,
    extract: (m) => m[1],
  },
  // Связь
  {
    pattern: /(телефон|трубк[аиу]|мобильн(?:ый|ик)|смартфон|рации[яюи]?)/gi,
    extract: (m) => m[1],
  },
  // Документы
  {
    pattern:
      /(документ[ыа]?|бумаг[иа]|письм[оа]|конверт|паспорт|удостоверени[ея]|папк[аиу])/gi,
    extract: (m) => m[1],
  },
  // Мебель/интерьер
  {
    pattern:
      /(пепельниц[аыу]|стакан|бутылк[аиу]|стол|стул|кресл[оа]|диван|кроват[ьи]|шкаф|зеркал[оа])/gi,
    extract: (m) => m[1],
  },
  // Электроника
  {
    pattern:
      /(телевизор|экран|монитор|компьютер|ноутбук|фонар[ьяи]к?|камер[аыу]|фотографи[яию])/gi,
    extract: (m) => m[1],
  },
  // Одежда/аксессуары
  {
    pattern:
      /(куртк[аиу]|пальто|шляп[аыу]|очки|сумк[аиу]|рюкзак|чемодан|ключ[ии]?)/gi,
    extract: (m) => m[1],
  },
  // Еда/напитки
  {
    pattern: /(сигарет[аыу]|окур(?:ок|ки)|кофе|чай|бокал|рюмк[аиу])/gi,
    extract: (m) => m[1],
  },
  // Misc
  {
    pattern: /(дверь|окно|штор[аыу]|забор|лестниц[аыу]|верёвк[аиу]|цеп[ьи])/gi,
    extract: (m) => m[1],
  },
];

function normalizePropName(raw: string): string {
  // Привести к именительному падежу (упрощённо — убрать окончания)
  return raw
    .replace(/[уюыиаое]$/i, "")
    .replace(/ок$/i, "ок") // окурок
    .replace(/к$/i, "к")
    .trim()
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

function extractSentence(text: string, matchIndex: number): string {
  // Find sentence boundaries around the match
  const before = text.slice(0, matchIndex);
  const after = text.slice(matchIndex);

  const sentenceStart = Math.max(
    before.lastIndexOf(".") + 1,
    before.lastIndexOf("!") + 1,
    before.lastIndexOf("?") + 1,
    before.lastIndexOf("\n") + 1,
    0,
  );

  const endOffsets = [
    after.indexOf("."),
    after.indexOf("!"),
    after.indexOf("?"),
    after.indexOf("\n"),
  ].filter((i) => i >= 0);

  const sentenceEnd =
    endOffsets.length > 0
      ? matchIndex + Math.min(...endOffsets) + 1
      : text.length;

  return text.slice(sentenceStart, sentenceEnd).trim();
}

export function parseProps(
  blocks: Block[],
  scenes: Scene[],
  existingProps?: PropEntry[],
): PropEntry[] {
  const props = new Map<string, PropEntry>();
  const mentions = new Map<string, string[]>();

  // Preserve existing entries
  if (existingProps) {
    for (const p of existingProps) {
      props.set(p.id, { ...p });
    }
  }

  for (const block of blocks) {
    // Only parse action blocks and scene headings (not dialogue/character)
    if (block.type !== "action" && block.type !== "scene_heading") continue;

    const text = block.text;
    const scene = getSceneForBlockId(scenes, block.id);

    for (const { pattern, extract } of PROP_PATTERNS) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const rawName = extract(match);
        if (!rawName || rawName.length < 2) continue;

        const normalized = normalizePropName(rawName);
        const id = slugify(normalized);
        if (!id) continue;

        const existing = props.get(id);
        const sceneIds = uniqueStrings([
          ...(existing?.sceneIds ?? []),
          scene?.id ?? "",
        ]);

        // Collect contextual mention
        const sentence = extractSentence(text, match.index);
        if (sentence) {
          const existing_mentions = mentions.get(id) ?? [];
          if (!existing_mentions.includes(sentence)) {
            existing_mentions.push(sentence);
            mentions.set(id, existing_mentions);
          }
        }

        if (!existing) {
          props.set(id, {
            id,
            name: normalized,
            description: "",
            sceneIds,
            referenceImages: [],
            canonicalImageId: null,
            generatedImageUrl: null,
            imageBlobKey: null,
            appearancePrompt: "",
          });
        } else {
          props.set(id, { ...existing, sceneIds });
        }
      }
    }
  }

  // Auto-fill description from script mentions (only if user hasn't written one)
  for (const [id, prop] of props) {
    if (!prop.description && mentions.has(id)) {
      const lines = mentions.get(id)!.slice(0, 3);
      props.set(id, { ...prop, description: lines.join(" · ") });
    }
  }

  return Array.from(props.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "ru"),
  );
}
