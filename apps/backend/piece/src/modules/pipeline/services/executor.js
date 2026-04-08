import { chatCompletion } from '../../ai/services/providers.js';
import { createComponentLogger } from '../../../utils/logger.js';

const componentLogger = createComponentLogger('PipelineExecutor');

export async function executePipeline({ nodes, edges, context, provider = 'anthropic' }) {
  const sorted = topologicalSort(nodes, edges);
  const results = new Map();

  for (const node of sorted) {
    const inputData = gatherInputs(node.id, edges, results);

    const output = await executeNode(node, inputData, context, provider);
    results.set(node.id, output);

    componentLogger.info('Node executed', { nodeId: node.id, nodeType: node.data?.type || node.type });
  }

  return Object.fromEntries(results);
}

function topologicalSort(nodes, edges) {
  const inDegree = new Map(nodes.map((n) => [n.id, 0]));
  const adjacency = new Map(nodes.map((n) => [n.id, []]));

  for (const edge of edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    adjacency.get(edge.source)?.push(edge.target);
  }

  const queue = nodes.filter((n) => inDegree.get(n.id) === 0);
  const sorted = [];

  while (queue.length > 0) {
    const node = queue.shift();
    sorted.push(node);

    for (const targetId of adjacency.get(node.id) || []) {
      const newDegree = (inDegree.get(targetId) ?? 1) - 1;
      inDegree.set(targetId, newDegree);
      if (newDegree === 0) {
        const targetNode = nodes.find((n) => n.id === targetId);
        if (targetNode) queue.push(targetNode);
      }
    }
  }

  return sorted;
}

function gatherInputs(nodeId, edges, results) {
  const inputs = {};
  for (const edge of edges) {
    if (edge.target === nodeId) {
      const sourceOutput = results.get(edge.source);
      if (sourceOutput !== undefined) {
        const handleKey = edge.targetHandle || 'default';
        inputs[handleKey] = sourceOutput;
      }
    }
  }
  return inputs;
}

function executeNode(node, inputs, context, provider) {
  const nodeType = node.data?.type || node.type;

  switch (nodeType) {
    case 'scene_analyst':
      return executeSceneAnalyst(node, inputs, context, provider);
    case 'shot_planner':
      return executeShotPlanner(node, inputs, context, provider);
    case 'prompt_composer':
      return executePromptComposer(node, inputs, context, provider);
    case 'foreach':
      return Promise.resolve(executeForeach(node, inputs));
    case 'code':
      return Promise.resolve(executeCode(node, inputs));
    default:
      return Promise.resolve(inputs.default ?? null);
  }
}

async function executeSceneAnalyst(node, inputs, context, provider) {
  const sceneText = inputs.default || inputs.scene || context?.sceneText || '';
  const systemPrompt = node.data?.systemPrompt || 'Analyze this screenplay scene. Identify characters, locations, props, mood, and key visual elements. Return structured JSON.';

  const result = await chatCompletion({
    provider,
    messages: [{ role: 'user', content: sceneText }],
    systemPrompt,
    temperature: 0.3,
  });

  try {
    const json = result.content.match(/\{[\s\S]*\}/);
    return json ? JSON.parse(json[0]) : { analysis: result.content };
  } catch {
    return { analysis: result.content };
  }
}

async function executeShotPlanner(node, inputs, context, provider) {
  const analysis = inputs.default || inputs.analysis || {};
  const systemPrompt = node.data?.systemPrompt || 'Plan shots for this scene. For each shot, specify: shot_size, camera_motion, duration, description, image_prompt. Return JSON array.';

  const result = await chatCompletion({
    provider,
    messages: [{ role: 'user', content: JSON.stringify(analysis) }],
    systemPrompt,
    temperature: 0.5,
  });

  try {
    const json = result.content.match(/\[[\s\S]*\]/);
    return json ? JSON.parse(json[0]) : [];
  } catch {
    return [];
  }
}

async function executePromptComposer(node, inputs, _context, provider) {
  const shots = inputs.default || inputs.shots || [];
  const bible = inputs.bible || {};
  const systemPrompt = node.data?.systemPrompt || 'Compose detailed image generation prompts for each shot. Include character appearances from bible, lighting, composition. Return JSON array with {shotId, prompt}.';

  const result = await chatCompletion({
    provider,
    messages: [{ role: 'user', content: JSON.stringify({ shots, bible }) }],
    systemPrompt,
    temperature: 0.7,
  });

  try {
    const json = result.content.match(/\[[\s\S]*\]/);
    return json ? JSON.parse(json[0]) : [];
  } catch {
    return [];
  }
}

function executeForeach(node, inputs) {
  const items = inputs.default || [];
  if (!Array.isArray(items)) return [items];
  return items;
}

function executeCode(node, inputs) {
  const code = node.data?.code || '';
  if (!code) return inputs.default;

  try {
    const parsed = JSON.parse(typeof inputs.default === 'string' ? inputs.default : JSON.stringify(inputs.default));
    return parsed;
  } catch {
    return inputs.default;
  }
}
