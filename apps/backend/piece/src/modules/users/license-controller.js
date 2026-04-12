import { licenseService } from "./license-service.js";
import { createComponentLogger } from "../../utils/logger.js";

const componentLogger = createComponentLogger("LicenseController");

async function getUserLicenses(req, res) {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, status } = req.query;
    const result = await licenseService.getUserLicenses(userId, {
      limit: Number(limit),
      offset: Number(offset),
      statusFilter: status || "active",
    });
    res.json(result);
  } catch (error) {
    componentLogger.error("Failed to get user licenses", {
      error: error.message,
    });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Failed to get licenses" });
  }
}

async function grantLicense(req, res) {
  try {
    const { userId } = req.params;
    const { productId, tier, source, externalId, expiresAt } = req.body;

    if (!productId || !tier) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "productId and tier are required",
      });
    }

    const license = await licenseService.grantLicense(userId, {
      productId,
      tier,
      source,
      externalId,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    res.status(201).json(license);
  } catch (error) {
    if (error.code === "INVALID_PRODUCT" || error.code === "INVALID_TIER") {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: error.message,
      });
    }
    componentLogger.error("Failed to grant license", {
      error: error.message,
      userId: req.params.userId,
    });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Failed to grant license" });
  }
}

async function revokeLicense(req, res) {
  try {
    const { userId, licenseId } = req.params;
    const revoked = await licenseService.revokeLicense(userId, licenseId);

    if (!revoked) {
      return res
        .status(404)
        .json({
          error: "NOT_FOUND",
          message: "License not found or already revoked",
        });
    }

    res.json({ message: "License revoked" });
  } catch (error) {
    componentLogger.error("Failed to revoke license", {
      error: error.message,
      userId: req.params.userId,
    });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Failed to revoke license" });
  }
}

export const licenseController = {
  getUserLicenses,
  grantLicense,
  revokeLicense,
};
