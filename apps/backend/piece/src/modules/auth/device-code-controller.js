import { deviceCodeService } from "./device-code-service.js";
import { desktopTokenService } from "./desktop-token-service.js";
import { createComponentLogger } from "../../utils/logger.js";

const componentLogger = createComponentLogger("DeviceCodeController");

export const deviceCodeController = {
  async requestDeviceCode(req, res) {
    try {
      const appId = req.body.appId || "piece-studio";

      const result = await deviceCodeService.createDeviceCode({ appId });

      return res.status(200).json(result);
    } catch (err) {
      componentLogger.error("Failed to create device code", {
        error: err.message,
      });
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Failed to create device code",
      });
    }
  },

  async pollDeviceCode(req, res) {
    try {
      const { deviceCode } = req.body;

      if (!deviceCode) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "deviceCode is required",
        });
      }

      const result = await deviceCodeService.pollDeviceCode(deviceCode);

      if (result.error === "expired_token") {
        return res.status(400).json({ error: "expired_token" });
      }

      if (result.error === "slow_down") {
        return res.status(400).json({ error: "slow_down" });
      }

      if (result.error === "authorization_pending") {
        return res.status(200).json({ error: "authorization_pending" });
      }

      return res.status(200).json({
        accessToken: result.accessToken,
        user: result.user,
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      componentLogger.error("Failed to poll device code", {
        error: err.message,
      });
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Failed to poll device code",
      });
    }
  },

  async verifyUserCode(req, res) {
    try {
      const { userCode } = req.body;

      if (!userCode) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "userCode is required",
        });
      }

      const result = await deviceCodeService.verifyUserCode(
        userCode,
        req.user.id,
      );

      return res.status(200).json(result);
    } catch (err) {
      if (err.message === "INVALID_CODE" || err.code === "INVALID_CODE") {
        return res.status(404).json({
          error: "INVALID_CODE",
          message: "Invalid or expired device code",
        });
      }

      componentLogger.error("Failed to verify user code", {
        error: err.message,
      });
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Failed to verify device code",
      });
    }
  },

  async listDesktopTokens(req, res) {
    try {
      const tokens = await desktopTokenService.listTokens(req.user.id);

      return res.status(200).json({ data: tokens });
    } catch (err) {
      componentLogger.error("Failed to list desktop tokens", {
        error: err.message,
      });
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Failed to list desktop tokens",
      });
    }
  },

  async revokeDesktopToken(req, res) {
    try {
      const { tokenId } = req.params;

      if (!tokenId) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "tokenId is required",
        });
      }

      const result = await desktopTokenService.revokeToken(
        tokenId,
        req.user.id,
      );

      return res.status(200).json(result);
    } catch (err) {
      if (err.message === "NOT_FOUND" || err.code === "NOT_FOUND") {
        return res.status(404).json({
          error: "NOT_FOUND",
          message: "Desktop token not found",
        });
      }

      componentLogger.error("Failed to revoke desktop token", {
        error: err.message,
      });
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Failed to revoke desktop token",
      });
    }
  },
};
