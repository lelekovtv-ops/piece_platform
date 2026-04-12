import { getGlobalSystemCollection } from "@piece/multitenancy";
import { mongoIdUtils } from "@piece/validation/mongo";
import { createComponentLogger } from "../../utils/logger.js";
import { hashToken } from "./utils.js";

const componentLogger = createComponentLogger("DesktopTokenService");

function getDesktopTokensCollection() {
  return getGlobalSystemCollection("desktop_tokens");
}

function getUsersCollection() {
  return getGlobalSystemCollection("users");
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: mongoIdUtils.toApiString(user._id),
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl || null,
    role: user.role,
  };
}

export const desktopTokenService = {
  async listTokens(userId) {
    const collection = getDesktopTokensCollection();
    const tokens = await collection
      .find({ userId, status: "active" })
      .sort({ createdAt: -1 })
      .toArray();

    return tokens.map((t) => ({
      id: mongoIdUtils.toApiString(t._id),
      appId: t.appId,
      status: t.status,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
      expiresAt: t.expiresAt,
    }));
  },

  async revokeToken(tokenId, userId) {
    const collection = getDesktopTokensCollection();
    const token = await collection.findOne({
      _id: mongoIdUtils.toObjectId(tokenId),
    });

    if (!token || token.userId !== userId) {
      const error = new Error("NOT_FOUND");
      error.code = "NOT_FOUND";
      throw error;
    }

    await collection.updateOne(
      { _id: token._id },
      { $set: { status: "revoked", revokedAt: new Date() } },
    );

    componentLogger.info("Desktop token revoked", { tokenId, userId });

    return { revoked: true };
  },

  async validateToken(rawToken) {
    const tokenHash = hashToken(rawToken);
    const collection = getDesktopTokensCollection();

    const tokenRecord = await collection.findOne({ tokenHash });

    if (!tokenRecord) {
      return null;
    }

    if (tokenRecord.status !== "active") {
      return null;
    }

    if (tokenRecord.expiresAt < new Date()) {
      return null;
    }

    const user = await getUsersCollection().findOne({
      _id: mongoIdUtils.toObjectId(tokenRecord.userId),
    });

    if (!user) {
      componentLogger.warn("Desktop token references missing user", {
        userId: tokenRecord.userId,
      });
      return null;
    }

    collection.updateOne(
      { _id: tokenRecord._id },
      { $set: { lastUsedAt: new Date() } },
    );

    return sanitizeUser(user);
  },
};
