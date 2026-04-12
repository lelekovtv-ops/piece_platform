import { Router } from "express";
import { deviceCodeController } from "./device-code-controller.js";
import { createRateLimiter } from "../../middleware/rate-limiter.js";

const router = Router();

const deviceCodeLimiter = createRateLimiter({
  maxRequests: 10,
  windowSeconds: 60,
});
const pollLimiter = createRateLimiter({ maxRequests: 20, windowSeconds: 60 });

router.post(
  "/v1/auth/device-code",
  deviceCodeLimiter,
  deviceCodeController.requestDeviceCode,
);
router.post(
  "/v1/auth/device-code/poll",
  pollLimiter,
  deviceCodeController.pollDeviceCode,
);

export function registerDeviceCodeRoutes(app, { authenticateToken } = {}) {
  if (authenticateToken) {
    router.post(
      "/v1/auth/device-code/verify",
      authenticateToken,
      deviceCodeController.verifyUserCode,
    );
    router.get(
      "/v1/auth/desktop-tokens",
      authenticateToken,
      deviceCodeController.listDesktopTokens,
    );
    router.delete(
      "/v1/auth/desktop-tokens/:tokenId",
      authenticateToken,
      deviceCodeController.revokeDesktopToken,
    );
  }

  app.use(router);
}
