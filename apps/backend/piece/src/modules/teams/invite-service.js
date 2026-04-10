import crypto from "node:crypto";
import { getGlobalSystemCollection } from "@piece/multitenancy";
import { mongoIdUtils } from "@piece/validation/mongo";
import { createComponentLogger } from "../../utils/logger.js";
import { teamService } from "./service.js";

const componentLogger = createComponentLogger("InviteService");

const ALLOWED_INVITE_ROLES = ["admin", "manager"];

function getInvitesCollection() {
  return getGlobalSystemCollection("team_invites");
}

function sanitizeInvite(invite) {
  if (!invite) return null;
  return {
    id: mongoIdUtils.toApiString(invite._id),
    token: invite.token,
    teamId: mongoIdUtils.toApiString(invite.teamId),
    role: invite.role,
    createdBy: mongoIdUtils.toApiString(invite.createdBy),
    createdAt: invite.createdAt,
  };
}

async function createInvite(teamId, role, createdBy) {
  if (!ALLOWED_INVITE_ROLES.includes(role)) {
    const error = new Error(
      `Invalid invite role: ${role}. Allowed: ${ALLOWED_INVITE_ROLES.join(", ")}`,
    );
    error.code = "INVALID_ROLE";
    throw error;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const invites = getInvitesCollection();

  const now = new Date();
  const result = await invites.insertOne({
    token,
    teamId: mongoIdUtils.toObjectId(teamId),
    role,
    createdBy: mongoIdUtils.toObjectId(createdBy),
    createdAt: now,
  });

  componentLogger.info("Invite created", { teamId, role, createdBy });

  return {
    id: mongoIdUtils.toApiString(result.insertedId),
    token,
    teamId,
    role,
    createdBy,
    createdAt: now,
  };
}

async function listInvites(teamId) {
  const invites = getInvitesCollection();
  const docs = await invites
    .find({
      teamId: mongoIdUtils.toObjectId(teamId),
    })
    .toArray();

  return docs.map(sanitizeInvite);
}

async function revokeInvite(teamId, inviteId) {
  const invites = getInvitesCollection();
  const result = await invites.deleteOne({
    _id: mongoIdUtils.toObjectId(inviteId),
    teamId: mongoIdUtils.toObjectId(teamId),
  });

  if (result.deletedCount === 0) return false;

  componentLogger.info("Invite revoked", { teamId, inviteId });
  return true;
}

async function getInviteByToken(token) {
  const invites = getInvitesCollection();
  const invite = await invites.findOne({ token });
  return sanitizeInvite(invite);
}

async function acceptInvite(token, userId) {
  const invite = await getInviteByToken(token);

  if (!invite) {
    const error = new Error("Invalid or expired invite token");
    error.code = "INVALID_INVITE";
    throw error;
  }

  await teamService.addMember(invite.teamId, userId, invite.role);
  const team = await teamService.getById(invite.teamId);

  componentLogger.info("Invite accepted", {
    teamId: invite.teamId,
    userId,
    role: invite.role,
  });

  return { team, role: invite.role };
}

export const inviteService = {
  createInvite,
  listInvites,
  revokeInvite,
  getInviteByToken,
  acceptInvite,
};
