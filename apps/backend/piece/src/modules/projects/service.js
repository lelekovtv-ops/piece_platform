import { getSystemCollection } from '@piece/multitenancy';
import { mongoIdUtils } from '@piece/validation/mongo';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('ProjectService');

const ELEVATED_ROLES = new Set(['owner', 'admin']);

function getProjectsCollection(teamId) {
  return getSystemCollection(teamId, 'projects');
}

function sanitizeProject(project) {
  if (!project) return null;
  return {
    id: mongoIdUtils.toApiString(project._id),
    name: project.name,
    ownerId: mongoIdUtils.toApiString(project.ownerId),
    description: project.description || '',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

async function create(teamId, { name, description, ownerId }) {
  const projects = getProjectsCollection(teamId);

  const now = new Date();
  const result = await projects.insertOne({
    name,
    description: description || '',
    ownerId: mongoIdUtils.toObjectId(ownerId),
    createdAt: now,
    updatedAt: now,
  });

  const projectId = mongoIdUtils.toApiString(result.insertedId);
  componentLogger.info('Project created', { teamId, projectId, ownerId });

  return {
    id: projectId,
    name,
    description: description || '',
    ownerId,
    createdAt: now,
    updatedAt: now,
  };
}

async function list(teamId, { limit = 20, offset = 0, ownerId } = {}) {
  const projects = getProjectsCollection(teamId);

  const filter = ownerId ? { ownerId: mongoIdUtils.toObjectId(ownerId) } : {};

  const [data, total] = await Promise.all([
    projects.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).toArray(),
    projects.countDocuments(filter),
  ]);

  return {
    data: data.map(sanitizeProject),
    pagination: { total, limit, offset, hasMore: offset + limit < total },
  };
}

async function getById(teamId, projectId) {
  const projects = getProjectsCollection(teamId);
  const project = await projects.findOne({ _id: mongoIdUtils.toObjectId(projectId) });
  return sanitizeProject(project);
}

async function update(teamId, projectId, updates, { userId, userRole } = {}) {
  const project = await getById(teamId, projectId);
  if (!project) return null;

  if (userId && !ELEVATED_ROLES.has(userRole) && project.ownerId !== userId) {
    return null;
  }

  const allowedFields = ['name', 'description'];
  const $set = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      $set[field] = updates[field];
    }
  }
  if (Object.keys($set).length === 0) return project;

  $set.updatedAt = new Date();

  const projects = getProjectsCollection(teamId);
  const result = await projects.findOneAndUpdate(
    { _id: mongoIdUtils.toObjectId(projectId) },
    { $set },
    { returnDocument: 'after' },
  );

  if (!result) return null;

  componentLogger.info('Project updated', { teamId, projectId });
  return sanitizeProject(result);
}

async function remove(teamId, projectId, { userId, userRole } = {}) {
  const project = await getById(teamId, projectId);
  if (!project) return false;

  if (userId && !ELEVATED_ROLES.has(userRole) && project.ownerId !== userId) {
    return false;
  }

  const projects = getProjectsCollection(teamId);
  const result = await projects.deleteOne({ _id: mongoIdUtils.toObjectId(projectId) });
  if (result.deletedCount === 0) return false;

  componentLogger.info('Project deleted', { teamId, projectId });
  return true;
}

export const projectService = {
  create,
  list,
  getById,
  update,
  remove,
};
