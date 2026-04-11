import { getGlobalSystemCollection } from "@piece/multitenancy";
import { mongoIdUtils } from "@piece/validation/mongo";
import { createComponentLogger } from "../../utils/logger.js";

const componentLogger = createComponentLogger("LicenseService");

const VALID_PRODUCTS = new Set(["piece-studio"]);
const VALID_TIERS = new Set(["free", "pro"]);

function getLicensesCollection() {
  return getGlobalSystemCollection("licenses");
}

async function getUserLicenses(
  userId,
  { limit = 20, offset = 0, statusFilter = "active" } = {},
) {
  const licenses = getLicensesCollection();
  const filter = { userId: mongoIdUtils.toObjectId(userId) };

  if (statusFilter) {
    filter.status = statusFilter;
  }

  const [data, total] = await Promise.all([
    licenses
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
    licenses.countDocuments(filter),
  ]);

  return {
    data: data.map((l) => ({
      id: mongoIdUtils.toApiString(l._id),
      productId: l.productId,
      tier: l.tier,
      status: l.status,
      source: l.source,
      externalId: l.externalId || null,
      activatedAt: l.activatedAt,
      expiresAt: l.expiresAt,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
    pagination: { total, limit, offset, hasMore: offset + limit < total },
  };
}

async function grantLicense(
  userId,
  { productId, tier, source, externalId, expiresAt },
) {
  if (!VALID_PRODUCTS.has(productId)) {
    const err = new Error("INVALID_PRODUCT");
    err.code = "INVALID_PRODUCT";
    throw err;
  }
  if (!VALID_TIERS.has(tier)) {
    const err = new Error("INVALID_TIER");
    err.code = "INVALID_TIER";
    throw err;
  }

  const now = new Date();
  const doc = {
    userId: mongoIdUtils.toObjectId(userId),
    productId,
    tier,
    status: "active",
    source: source || "manual",
    externalId: externalId || null,
    activatedAt: now,
    expiresAt: expiresAt || null,
    createdAt: now,
    updatedAt: now,
  };

  const licenses = getLicensesCollection();
  const result = await licenses.insertOne(doc);

  componentLogger.info("License granted", {
    userId,
    productId,
    tier,
    licenseId: result.insertedId,
  });

  return {
    id: mongoIdUtils.toApiString(result.insertedId),
    productId,
    tier,
    status: "active",
    source: doc.source,
    externalId: doc.externalId,
    activatedAt: doc.activatedAt,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function revokeLicense(userId, licenseId) {
  const licenses = getLicensesCollection();
  const result = await licenses.updateOne(
    {
      _id: mongoIdUtils.toObjectId(licenseId),
      userId: mongoIdUtils.toObjectId(userId),
      status: "active",
    },
    { $set: { status: "revoked", updatedAt: new Date() } },
  );

  if (result.matchedCount === 0) {
    return false;
  }

  componentLogger.info("License revoked", { userId, licenseId });
  return true;
}

async function hasActiveLicense(userId, productId) {
  const licenses = getLicensesCollection();
  const now = new Date();

  const license = await licenses.findOne({
    userId: mongoIdUtils.toObjectId(userId),
    productId,
    status: "active",
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  });

  return license !== null;
}

export const licenseService = {
  getUserLicenses,
  grantLicense,
  revokeLicense,
  hasActiveLicense,
};
