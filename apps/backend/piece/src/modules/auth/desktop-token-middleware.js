import { desktopTokenService } from "./desktop-token-service.js";
import { createComponentLogger } from "../../utils/logger.js";

const componentLogger = createComponentLogger("DesktopTokenMiddleware");

export function createDesktopTokenMiddleware() {
  return async function authenticateDesktopToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "INVALID_DESKTOP_TOKEN",
        message: "Missing or invalid Authorization header",
      });
    }

    const rawToken = authHeader.slice(7);

    try {
      const user = await desktopTokenService.validateToken(rawToken);

      if (!user) {
        return res.status(401).json({
          error: "INVALID_DESKTOP_TOKEN",
          message: "Invalid, expired, or revoked desktop token",
        });
      }

      req.user = user;
      next();
    } catch (err) {
      componentLogger.error("Desktop token validation error", {
        error: err.message,
      });
      return res.status(401).json({
        error: "INVALID_DESKTOP_TOKEN",
        message: "Failed to validate desktop token",
      });
    }
  };
}
