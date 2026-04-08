import { getGlobalSystemCollection } from '@piece/multitenancy';
import { mongoIdUtils } from '@piece/validation/mongo';
import { createCache, StandardTTL } from '@piece/cache';
import { createComponentLogger } from '../../utils/logger.js';
import { initializeTeamDatabase } from '../../db/index.js';

const componentLogger = createComponentLogger('TeamService');

const memberRoleCache = createCache({ prefix: 'membership' });

function getTeamsCollection() {
  return getGlobalSystemCollection('teams');
}

function getMembersCollection() {
  return getGlobalSystemCollection('team_members');
}

function sanitizeTeam(team) {
  if (!team) return null;
  return {
    id: mongoIdUtils.toApiString(team._id),
    name: team.name,
    ownerId: mongoIdUtils.toApiString(team.ownerId),
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
}

async function create({ name, ownerId }) {
  const teams = getTeamsCollection();
  const members = getMembersCollection();

  const now = new Date();
  const result = await teams.insertOne({
    name,
    ownerId: mongoIdUtils.toObjectId(ownerId),
    createdAt: now,
    updatedAt: now,
  });

  const teamId = mongoIdUtils.toApiString(result.insertedId);

  await members.insertOne({
    teamId: result.insertedId,
    userId: mongoIdUtils.toObjectId(ownerId),
    role: 'owner',
    joinedAt: now,
    updatedAt: now,
  });

  await initializeTeamDatabase(teamId);

  componentLogger.info('Team created', { teamId, ownerId });

  return {
    id: teamId,
    name,
    ownerId,
    createdAt: now,
    updatedAt: now,
  };
}

async function listByUser(userId) {
  const members = getMembersCollection();
  const teams = getTeamsCollection();

  const memberships = await members.find({
    userId: mongoIdUtils.toObjectId(userId),
  }).toArray();

  if (memberships.length === 0) return [];

  const teamIds = memberships.map((m) => m.teamId);
  const teamDocs = await teams.find({ _id: { $in: teamIds } }).sort({ createdAt: -1 }).toArray();

  const roleMap = new Map(memberships.map((m) => [m.teamId.toString(), m.role]));

  return teamDocs.map((t) => ({
    ...sanitizeTeam(t),
    role: roleMap.get(t._id.toString()) || 'viewer',
  }));
}

async function getById(teamId) {
  const teams = getTeamsCollection();
  const team = await teams.findOne({ _id: mongoIdUtils.toObjectId(teamId) });
  return sanitizeTeam(team);
}

async function update(teamId, updates) {
  const allowedFields = ['name'];
  const $set = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      $set[field] = updates[field];
    }
  }
  if (Object.keys($set).length === 0) return getById(teamId);

  $set.updatedAt = new Date();

  const teams = getTeamsCollection();
  const result = await teams.findOneAndUpdate(
    { _id: mongoIdUtils.toObjectId(teamId) },
    { $set },
    { returnDocument: 'after' },
  );

  if (!result) return null;

  componentLogger.info('Team updated', { teamId });
  return sanitizeTeam(result);
}

async function addMember(teamId, userId, role = 'manager') {
  const members = getMembersCollection();

  const existing = await members.findOne({
    teamId: mongoIdUtils.toObjectId(teamId),
    userId: mongoIdUtils.toObjectId(userId),
  });

  if (existing) {
    const error = new Error('User is already a member of this team');
    error.code = 'ALREADY_MEMBER';
    throw error;
  }

  const now = new Date();
  await members.insertOne({
    teamId: mongoIdUtils.toObjectId(teamId),
    userId: mongoIdUtils.toObjectId(userId),
    role,
    joinedAt: now,
    updatedAt: now,
  });

  componentLogger.info('Member added', { teamId, userId, role });
  return { teamId, userId, role, joinedAt: now };
}

async function removeMember(teamId, userId) {
  const members = getMembersCollection();
  const result = await members.deleteOne({
    teamId: mongoIdUtils.toObjectId(teamId),
    userId: mongoIdUtils.toObjectId(userId),
  });
  if (result.deletedCount === 0) return false;

  await memberRoleCache.del(`${teamId}:${userId}`);
  componentLogger.info('Member removed', { teamId, userId });
  return true;
}

async function getMembers(teamId) {
  const members = getMembersCollection();
  const docs = await members.find({
    teamId: mongoIdUtils.toObjectId(teamId),
  }).toArray();

  return docs.map((m) => ({
    userId: mongoIdUtils.toApiString(m.userId),
    role: m.role,
    joinedAt: m.joinedAt,
  }));
}

async function getMemberRole(teamId, userId) {
  const cacheKey = `${teamId}:${userId}`;
  const cached = await memberRoleCache.get(cacheKey);
  if (cached) return cached;

  const members = getMembersCollection();
  const member = await members.findOne({
    teamId: mongoIdUtils.toObjectId(teamId),
    userId: mongoIdUtils.toObjectId(userId),
  });
  const role = member?.role || null;

  if (role) {
    await memberRoleCache.set(cacheKey, role, StandardTTL.MEDIUM);
  }

  return role;
}

export const teamService = {
  create,
  listByUser,
  getById,
  update,
  addMember,
  removeMember,
  getMembers,
  getMemberRole,
};
