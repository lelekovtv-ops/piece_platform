import { Router } from "express";
import { licenseController } from "./license-controller.js";

export function registerLicenseRoutes(
  app,
  {
    authenticateToken,
    authenticateInternalToken,
    authenticateDesktopToken,
  } = {},
) {
  const router = Router();

  function authenticateAny(req, res, next) {
    authenticateToken(req, res, (err) => {
      if (!err && req.user) {
        return next();
      }
      if (authenticateDesktopToken) {
        return authenticateDesktopToken(req, res, next);
      }
      return res
        .status(401)
        .json({ error: "UNAUTHORIZED", message: "Authentication required" });
    });
  }

  router.get(
    "/v1/me/licenses",
    authenticateAny,
    licenseController.getUserLicenses,
  );

  if (authenticateInternalToken) {
    router.post(
      "/admin/users/:userId/licenses",
      authenticateInternalToken,
      licenseController.grantLicense,
    );
    router.delete(
      "/admin/users/:userId/licenses/:licenseId",
      authenticateInternalToken,
      licenseController.revokeLicense,
    );
  }

  app.use(router);
}
