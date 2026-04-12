import crypto from "node:crypto";
import { getGlobalSystemCollection } from "@piece/multitenancy";
import { mongoIdUtils } from "@piece/validation/mongo";
import { createComponentLogger } from "../../utils/logger.js";
import { config } from "../../config.js";
import { hashToken } from "./utils.js";

const componentLogger = createComponentLogger("DeviceCodeService");

const DEVICE_CODE_TTL_SECONDS = 600;
const POLL_INTERVAL_SECONDS = 5;
const DESKTOP_TOKEN_TTL_DAYS = 90;
const UNAMBIGUOUS_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ123456789";

function getDeviceCodesCollection() {
  return getGlobalSystemCollection("device_codes");
}

function getDesktopTokensCollection() {
  return getGlobalSystemCollection("desktop_tokens");
}

function getUsersCollection() {
  return getGlobalSystemCollection("users");
}

function generateUserCode() {
  const chars = [];
  for (let i = 0; i < 8; i++) {
    const randomIndex = crypto.randomInt(0, UNAMBIGUOUS_CHARS.length);
    chars.push(UNAMBIGUOUS_CHARS[randomIndex]);
  }
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

function generateDesktopToken() {
  return crypto.randomBytes(32).toString("hex");
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

export const deviceCodeService = {
  async createDeviceCode({ appId }) {
    const deviceCode = crypto.randomBytes(32).toString("hex");
    const userCode = generateUserCode();
    const userCodeHash = hashToken(userCode);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEVICE_CODE_TTL_SECONDS * 1000);

    const pieceUrl = config.get("PIECE_URL") || "https://app.piece.dev";

    await getDeviceCodesCollection().insertOne({
      deviceCode,
      userCodeHash,
      appId,
      status: "pending",
      userId: null,
      interval: POLL_INTERVAL_SECONDS,
      lastPolledAt: null,
      expiresAt,
      createdAt: now,
    });

    componentLogger.info("Device code created", { appId });

    return {
      deviceCode,
      userCode,
      verificationUri: `${pieceUrl}/device`,
      expiresIn: DEVICE_CODE_TTL_SECONDS,
      interval: POLL_INTERVAL_SECONDS,
    };
  },

  async pollDeviceCode(deviceCode) {
    const collection = getDeviceCodesCollection();
    const record = await collection.findOne({ deviceCode });

    if (!record) {
      return { status: "expired", error: "expired_token" };
    }

    if (record.expiresAt < new Date()) {
      return { status: "expired", error: "expired_token" };
    }

    if (record.status === "pending") {
      if (record.lastPolledAt) {
        const elapsed = Date.now() - record.lastPolledAt.getTime();
        if (elapsed < (record.interval || POLL_INTERVAL_SECONDS) * 1000) {
          return { status: "slow_down", error: "slow_down" };
        }
      }

      collection.updateOne(
        { _id: record._id },
        { $set: { lastPolledAt: new Date() } },
      );

      return { status: "pending", error: "authorization_pending" };
    }

    if (record.status === "approved") {
      const user = await getUsersCollection().findOne({
        _id: mongoIdUtils.toObjectId(record.userId),
      });

      if (!user) {
        componentLogger.error("Approved device code references missing user", {
          userId: record.userId,
        });
        return { status: "expired", error: "expired_token" };
      }

      const desktopToken = generateDesktopToken();
      const tokenHash = hashToken(desktopToken);
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + DESKTOP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      );

      await getDesktopTokensCollection().insertOne({
        userId: mongoIdUtils.toApiString(user._id),
        tokenHash,
        appId: record.appId,
        status: "active",
        expiresAt,
        createdAt: now,
        lastUsedAt: now,
      });

      await collection.deleteOne({ _id: record._id });

      componentLogger.info("Desktop token issued via device code", {
        userId: mongoIdUtils.toApiString(user._id),
        appId: record.appId,
      });

      return {
        status: "approved",
        accessToken: desktopToken,
        user: sanitizeUser(user),
        expiresAt: expiresAt.toISOString(),
      };
    }

    return { status: "expired", error: "expired_token" };
  },

  async verifyUserCode(userCode, userId) {
    const userCodeHash = hashToken(
      userCode.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    );
    const collection = getDeviceCodesCollection();

    const record = await collection.findOne({
      userCodeHash,
      status: "pending",
    });

    if (!record || record.expiresAt < new Date()) {
      const error = new Error("INVALID_CODE");
      error.code = "INVALID_CODE";
      throw error;
    }

    await collection.updateOne(
      { _id: record._id },
      { $set: { status: "approved", userId, approvedAt: new Date() } },
    );

    componentLogger.info("Device code verified by user", {
      userId,
      appId: record.appId,
    });

    return { appId: record.appId, approved: true };
  },
};
