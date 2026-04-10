import { Router } from "express";
import { teamController } from "./controller.js";

export function registerTeamRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }

  router.get("/v1/teams", teamController.list);
  router.post("/v1/teams", teamController.create);
  router.get("/v1/teams/:teamId", teamController.getById);
  router.patch("/v1/teams/:teamId", teamController.update);
  router.get("/v1/teams/:teamId/members", teamController.getMembers);
  router.post("/v1/teams/:teamId/members", teamController.addMember);
  router.delete(
    "/v1/teams/:teamId/members/:userId",
    teamController.removeMember,
  );

  router.post("/v1/teams/:teamId/invites", teamController.createInvite);
  router.get("/v1/teams/:teamId/invites", teamController.listInvites);
  router.delete(
    "/v1/teams/:teamId/invites/:inviteId",
    teamController.revokeInvite,
  );

  app.use(router);
}
