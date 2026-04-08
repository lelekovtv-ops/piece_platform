import { getEffectiveDuration, computeGapMs } from '../../screenplay/services/duration-engine.js';

export function getChildren(entries, parentEntryId) {
  return entries
    .filter((e) => e.parentEntryId === parentEntryId)
    .sort((a, b) => a.order - b.order);
}

export function getTopLevel(entries) {
  return entries
    .filter((e) => e.parentEntryId === null)
    .sort((a, b) => a.order - b.order);
}

export function hasChildren(entries, entryId) {
  return entries.some((e) => e.parentEntryId === entryId);
}

export function getAncestorChain(entries, entryId) {
  const chain = [];
  const map = new Map(entries.map((e) => [e.id, e]));
  let current = map.get(entryId);

  while (current) {
    chain.push(current);
    current = current.parentEntryId ? map.get(current.parentEntryId) : undefined;
  }

  return chain;
}

export function getEffectiveEntries(entries) {
  const headingIds = new Set(
    entries.filter((e) => e.entryType === 'heading').map((e) => e.id),
  );

  const result = [];
  const topLevel = getTopLevel(entries);

  for (const entry of topLevel) {
    if (headingIds.has(entry.id)) {
      const children = getChildren(entries, entry.id);
      result.push(...children);
    } else {
      result.push(entry);
    }
  }

  return result;
}

export function recalculateParentDurations(entries) {
  const headingIds = new Set(
    entries.filter((e) => e.entryType === 'heading').map((e) => e.id),
  );

  if (headingIds.size === 0) return entries;

  const headingDurations = new Map();

  for (const entry of entries) {
    if (entry.parentEntryId && headingIds.has(entry.parentEntryId)) {
      const current = headingDurations.get(entry.parentEntryId) ?? 0;
      headingDurations.set(entry.parentEntryId, current + getEffectiveDuration(entry));
    }
  }

  return entries.map((e) => {
    if (headingIds.has(e.id) && headingDurations.has(e.id)) {
      return { ...e, estimatedDurationMs: headingDurations.get(e.id) };
    }
    return e;
  });
}

export function flattenForTimeline(entries) {
  const effective = getEffectiveEntries(entries);
  const positions = [];
  let cursor = 0;

  for (const entry of effective) {
    const duration = getEffectiveDuration(entry);
    const gapMs = computeGapMs(entry);

    positions.push({
      entryId: entry.id,
      parentBlockId: entry.parentBlockId,
      parentEntryId: entry.parentEntryId,
      startMs: cursor,
      endMs: cursor + duration,
      durationMs: duration,
      track: 'visual',
      gapMs,
      label: entry.label,
      caption: entry.caption,
      speaker: entry.speaker,
      entryType: entry.entryType,
      thumbnailUrl: entry.visual?.thumbnailUrl ?? null,
    });

    if (entry.entryType === 'dialogue' && entry.speaker) {
      positions.push({
        entryId: entry.id,
        parentBlockId: entry.parentBlockId,
        parentEntryId: entry.parentEntryId,
        startMs: cursor,
        endMs: cursor + duration,
        durationMs: duration,
        track: 'voice',
        gapMs: 0,
        label: entry.speaker,
        caption: entry.caption,
        speaker: entry.speaker,
        entryType: entry.entryType,
        thumbnailUrl: null,
      });

      positions.push({
        entryId: entry.id,
        parentBlockId: entry.parentBlockId,
        parentEntryId: entry.parentEntryId,
        startMs: cursor,
        endMs: cursor + duration,
        durationMs: duration,
        track: 'titles',
        gapMs: 0,
        label: entry.speaker,
        caption: `${entry.speaker}: ${entry.caption}`,
        speaker: entry.speaker,
        entryType: entry.entryType,
        thumbnailUrl: null,
      });
    }

    cursor += duration;
  }

  return positions;
}

export function getTotalDuration(entries) {
  const effective = getEffectiveEntries(entries);
  return effective.reduce((sum, e) => sum + getEffectiveDuration(e), 0);
}

export function getEntryAtTime(entries, timeMs) {
  const effective = getEffectiveEntries(entries);
  let cursor = 0;

  for (const entry of effective) {
    const duration = getEffectiveDuration(entry);
    if (timeMs >= cursor && timeMs < cursor + duration) {
      return entry;
    }
    cursor += duration;
  }

  return null;
}
