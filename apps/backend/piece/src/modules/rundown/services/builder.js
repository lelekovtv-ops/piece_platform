import { createRundownEntry } from '@piece/domain-types/rundown';
import {
  estimateBlockDurationMs,
  dialogueDurationMs,
  actionDurationMs,
} from '../../screenplay/services/duration-engine.js';

export function simpleHash(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

export function snapshotBlocks(blocks) {
  return blocks.map((b) => ({
    id: b.id,
    type: b.type,
    textHash: simpleHash(b.text),
  }));
}

export function diffBlockSnapshots(prev, next) {
  const prevMap = new Map(prev.map((b) => [b.id, b]));
  const nextMap = new Map(next.map((b) => [b.id, b]));

  const addedBlockIds = [];
  const removedBlockIds = [];
  const typeChangedBlockIds = [];
  const textChangedBlockIds = [];

  for (const [id, nb] of nextMap) {
    const pb = prevMap.get(id);
    if (!pb) {
      addedBlockIds.push(id);
    } else {
      if (pb.type !== nb.type) typeChangedBlockIds.push(id);
      else if (pb.textHash !== nb.textHash) textChangedBlockIds.push(id);
    }
  }

  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) removedBlockIds.push(id);
  }

  return {
    hasStructuralChanges: addedBlockIds.length > 0 || removedBlockIds.length > 0 || typeChangedBlockIds.length > 0,
    addedBlockIds,
    removedBlockIds,
    typeChangedBlockIds,
    textChangedBlockIds,
  };
}

export function buildRundownEntries(blocks, scenes) {
  const entries = [];

  const blockToScene = new Map();
  for (const scene of scenes) {
    for (const bid of scene.blockIds) {
      blockToScene.set(bid, scene.id);
    }
  }

  const sceneShotCounters = new Map();

  let pendingCharName = null;
  let pendingCharIsVO = false;
  let pendingBlockIds = [];
  let pendingDialogueText = '';

  const flushDialogueGroup = (sceneId) => {
    if (pendingCharName && pendingBlockIds.length > 0 && pendingDialogueText.trim()) {
      const counter = (sceneShotCounters.get(sceneId) ?? 0) + 1;
      sceneShotCounters.set(sceneId, counter);

      const primaryBlockId = pendingBlockIds[pendingBlockIds.length - 1];

      entries.push(createRundownEntry({
        parentBlockId: primaryBlockId,
        entryType: 'dialogue',
        order: entries.length,
        label: `Shot ${counter}`,
        caption: pendingDialogueText.trim(),
        sourceText: pendingDialogueText.trim(),
        speaker: pendingCharName,
        isVO: pendingCharIsVO,
        estimatedDurationMs: dialogueDurationMs(pendingDialogueText),
        autoSynced: true,
      }));
    }
    pendingCharName = null;
    pendingCharIsVO = false;
    pendingBlockIds = [];
    pendingDialogueText = '';
  };

  for (const block of blocks) {
    const text = block.text.trim();
    if (!text) continue;

    const sceneId = blockToScene.get(block.id) ?? '';

    switch (block.type) {
      case 'scene_heading': {
        flushDialogueGroup(sceneId);
        break;
      }

      case 'action': {
        flushDialogueGroup(sceneId);
        const counter = (sceneShotCounters.get(sceneId) ?? 0) + 1;
        sceneShotCounters.set(sceneId, counter);

        const isFirstInScene = counter === 1;

        entries.push(createRundownEntry({
          parentBlockId: block.id,
          entryType: isFirstInScene ? 'establishing' : 'action',
          order: entries.length,
          label: isFirstInScene ? text.slice(0, 40) : `Shot ${counter}`,
          caption: text,
          sourceText: text,
          estimatedDurationMs: actionDurationMs(text),
          autoSynced: true,
        }));
        break;
      }

      case 'character': {
        flushDialogueGroup(sceneId);
        const rawName = text.replace(/\s*\(.*\)\s*$/, '').trim();
        pendingCharName = rawName;
        pendingCharIsVO = /\(V\.?O\.?\)/.test(text);
        pendingBlockIds = [block.id];
        break;
      }

      case 'parenthetical': {
        if (pendingBlockIds.length > 0) {
          pendingBlockIds.push(block.id);
          if (/V\.?O\.?/i.test(text)) pendingCharIsVO = true;
        }
        break;
      }

      case 'dialogue': {
        if (pendingCharName) {
          pendingBlockIds.push(block.id);
          pendingDialogueText = text;
          flushDialogueGroup(sceneId);
        } else {
          const counter = (sceneShotCounters.get(sceneId) ?? 0) + 1;
          sceneShotCounters.set(sceneId, counter);
          entries.push(createRundownEntry({
            parentBlockId: block.id,
            entryType: 'action',
            order: entries.length,
            label: `Shot ${counter}`,
            caption: text,
            sourceText: text,
            estimatedDurationMs: dialogueDurationMs(text),
            autoSynced: true,
          }));
        }
        break;
      }

      case 'transition': {
        flushDialogueGroup(sceneId);
        entries.push(createRundownEntry({
          parentBlockId: block.id,
          entryType: 'transition',
          order: entries.length,
          label: text,
          caption: text,
          sourceText: text,
          estimatedDurationMs: estimateBlockDurationMs('transition', text),
          autoSynced: true,
        }));
        break;
      }

      default: {
        flushDialogueGroup(sceneId);
        const counter = (sceneShotCounters.get(sceneId) ?? 0) + 1;
        sceneShotCounters.set(sceneId, counter);
        entries.push(createRundownEntry({
          parentBlockId: block.id,
          entryType: 'action',
          order: entries.length,
          label: `Shot ${counter}`,
          caption: text,
          sourceText: text,
          estimatedDurationMs: actionDurationMs(text),
          autoSynced: true,
        }));
        break;
      }
    }
  }

  const lastSceneId = blocks.length > 0 ? blockToScene.get(blocks[blocks.length - 1].id) ?? '' : '';
  flushDialogueGroup(lastSceneId);

  return entries;
}

export function reconcileRundownEntries(newEntries, existingEntries) {
  const existingByBlock = new Map();
  const preserved = [];

  for (const entry of existingEntries) {
    if (entry.locked || !entry.autoSynced) {
      preserved.push(entry);
    } else if (entry.parentEntryId === null) {
      existingByBlock.set(entry.parentBlockId, entry);
    }
  }

  const preservedParentIds = new Set(preserved.map((e) => e.id));
  for (const entry of existingEntries) {
    if (entry.parentEntryId && preservedParentIds.has(entry.parentEntryId)) {
      preserved.push(entry);
    }
  }

  const result = [];

  for (const newEntry of newEntries) {
    const existing = existingByBlock.get(newEntry.parentBlockId);
    if (existing) {
      result.push({
        ...existing,
        label: newEntry.label,
        caption: newEntry.caption,
        sourceText: newEntry.sourceText,
        entryType: newEntry.entryType,
        estimatedDurationMs: newEntry.estimatedDurationMs,
        speaker: newEntry.speaker,
        isVO: newEntry.isVO,
        order: newEntry.order,
      });
      existingByBlock.delete(newEntry.parentBlockId);
    } else {
      result.push(newEntry);
    }
  }

  result.push(...preserved);
  result.sort((a, b) => a.order - b.order);

  return result;
}
