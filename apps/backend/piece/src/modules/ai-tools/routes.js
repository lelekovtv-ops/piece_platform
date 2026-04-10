import { Router } from "express";
import { aiToolsController } from "./controller.js";

export function registerAiToolsRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }

  router.post("/v1/tools/nano-banana", aiToolsController.nanoBanana);
  router.post("/v1/tools/ambient-image", aiToolsController.ambientImage);
  router.post("/v1/tools/ambient-prompt", aiToolsController.ambientPrompt);
  router.post("/v1/tools/classify-intent", aiToolsController.classifyIntent);
  router.post("/v1/tools/sjinn", aiToolsController.sjinnCreate);
  router.get("/v1/tools/sjinn/:taskId", aiToolsController.sjinnPoll);
  router.post("/v1/tools/photo-to-3d", aiToolsController.photoTo3dCreate);
  router.get("/v1/tools/photo-to-3d/:taskId", aiToolsController.photoTo3dPoll);
  router.post("/v1/tools/smart-distribute", aiToolsController.smartDistribute);

  app.use(router);
}
