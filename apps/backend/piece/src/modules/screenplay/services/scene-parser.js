import { estimateBlockDurationMs, MIN_SCENE_MS } from './duration-engine.js';

export const SCENE_COLORS = Object.freeze([
  '#4A7C6F', '#7C4A6F', '#6F7C4A', '#4A6F7C', '#7C6F4A', '#6F4A7C',
  '#5A8C7F', '#8C5A7F', '#7F8C5A', '#5A7F8C', '#8C7F5A', '#7F5A8C',
]);

function estimateSceneDurationMs(sceneBlocks) {
  let totalMs = 0;
  for (const block of sceneBlocks) {
    totalMs += estimateBlockDurationMs(block.type, block.text);
  }
  return Math.max(MIN_SCENE_MS, Math.round(totalMs));
}

export function parseScenes(blocks) {
  const scenes = [];
  let current = null;

  for (const block of blocks) {
    if (block.type === 'scene_heading') {
      if (current) scenes.push(current);

      const sceneIndex = scenes.length + 1;
      current = {
        id: `scene-${block.id}`,
        index: sceneIndex,
        title: block.text.trim() || 'UNTITLED SCENE',
        headingBlockId: block.id,
        blockIds: [block.id],
        color: SCENE_COLORS[(sceneIndex - 1) % SCENE_COLORS.length],
        estimatedDurationMs: 0,
      };
    } else {
      if (!current) {
        current = {
          id: 'scene-untitled-0',
          index: 0,
          title: 'UNTITLED SCENE',
          headingBlockId: '',
          blockIds: [block.id],
          color: SCENE_COLORS[0],
          estimatedDurationMs: 0,
        };
      } else {
        current.blockIds.push(block.id);
      }
    }
  }

  if (current) scenes.push(current);

  const blockMap = new Map(blocks.map((b) => [b.id, b]));
  for (const scene of scenes) {
    const sceneBlocks = scene.blockIds.map((id) => blockMap.get(id)).filter(Boolean);
    scene.estimatedDurationMs = estimateSceneDurationMs(sceneBlocks);
  }

  return scenes;
}

export function getSceneForBlock(scenes, blockId) {
  return scenes.find((s) => s.blockIds.includes(blockId)) ?? null;
}

export function getSceneByIndex(scenes, index) {
  return scenes.find((s) => s.index === index) ?? null;
}

export function getBlockSceneIndex(scenes, blockId) {
  const scene = getSceneForBlock(scenes, blockId);
  return scene ? scene.index : null;
}
