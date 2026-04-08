import { getSystemCollection } from '@piece/multitenancy';
import { mongoIdUtils } from '@piece/validation/mongo';
import { createComponentLogger } from '../../utils/logger.js';
import { executePipeline } from './services/executor.js';

const componentLogger = createComponentLogger('PipelineService');

function getPresetsCollection(teamId) {
  return getSystemCollection(teamId, 'pipeline_presets');
}

async function run(teamId, projectId, { nodes, edges, context, provider }) {
  componentLogger.info('Pipeline execution started', { teamId, projectId, nodeCount: nodes.length });

  const results = await executePipeline({ nodes, edges, context, provider });

  componentLogger.info('Pipeline execution completed', { teamId, projectId });
  return results;
}

function listPresets(teamId, projectId) {
  const collection = getPresetsCollection(teamId);
  return collection
    .find({ projectId: mongoIdUtils.toObjectId(projectId) })
    .sort({ name: 1 })
    .toArray()
    .then((docs) => docs.map((d) => ({ id: mongoIdUtils.toApiString(d._id), ...d, _id: undefined })));
}

async function savePreset(teamId, projectId, { name, nodes, edges }) {
  const collection = getPresetsCollection(teamId);
  const now = new Date();

  const result = await collection.insertOne({
    projectId: mongoIdUtils.toObjectId(projectId),
    name,
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
  });

  componentLogger.info('Pipeline preset saved', { teamId, projectId, name });
  return { id: mongoIdUtils.toApiString(result.insertedId), name, nodes, edges };
}

export const pipelineService = {
  run,
  listPresets,
  savePreset,
};
