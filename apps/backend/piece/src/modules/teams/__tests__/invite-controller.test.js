import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@piece/multitenancy", () => ({
  getGlobalSystemCollection: vi.fn(() => ({
    findOne: vi.fn(),
    find: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
    insertOne: vi.fn().mockResolvedValue({ insertedId: "mock-id" }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  })),
}));

vi.mock("@piece/validation/mongo", () => ({
  mongoIdUtils: {
    toObjectId: vi.fn((id) => id),
    toApiString: vi.fn((id) => id?.toString?.() ?? id),
    isValid: vi.fn(() => true),
  },
}));

vi.mock("@piece/cache", () => ({
  createCache: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
    del: vi.fn(),
  })),
  StandardTTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
}));

vi.mock("../../../../utils/logger.js", () => ({
  createComponentLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("../../../../db/index.js", () => ({
  initializeTeamDatabase: vi.fn().mockResolvedValue(undefined),
}));

const mockCreateInvite = vi.fn();
const mockListInvites = vi.fn();
const mockRevokeInvite = vi.fn();

vi.mock("../../teams/invite-service.js", () => ({
  inviteService: {
    createInvite: mockCreateInvite,
    listInvites: mockListInvites,
    revokeInvite: mockRevokeInvite,
  },
}));

const { teamController } = await import("../../teams/controller.js");

function createMockReq(overrides = {}) {
  return {
    params: {},
    body: {},
    user: { id: "user-1" },
    ...overrides,
  };
}

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res;
}

describe("TeamController — Invite endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createInvite", () => {
    it("should create an invite and return 201", async () => {
      const invite = {
        id: "inv-1",
        token: "abc",
        teamId: "team-1",
        role: "manager",
        createdBy: "user-1",
      };
      mockCreateInvite.mockResolvedValueOnce(invite);

      const req = createMockReq({
        params: { teamId: "team-1" },
        body: { role: "manager" },
      });
      const res = createMockRes();

      await teamController.createInvite(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(invite);
      expect(mockCreateInvite).toHaveBeenCalledWith(
        "team-1",
        "manager",
        "user-1",
      );
    });

    it("should return 400 when role is missing", async () => {
      const req = createMockReq({ params: { teamId: "team-1" }, body: {} });
      const res = createMockRes();

      await teamController.createInvite(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "VALIDATION_ERROR" }),
      );
    });

    it("should return 400 for invalid role", async () => {
      const error = new Error("Invalid invite role: owner");
      error.code = "INVALID_ROLE";
      mockCreateInvite.mockRejectedValueOnce(error);

      const req = createMockReq({
        params: { teamId: "team-1" },
        body: { role: "owner" },
      });
      const res = createMockRes();

      await teamController.createInvite(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "VALIDATION_ERROR" }),
      );
    });

    it("should return 500 on unexpected error", async () => {
      mockCreateInvite.mockRejectedValueOnce(new Error("DB error"));

      const req = createMockReq({
        params: { teamId: "team-1" },
        body: { role: "manager" },
      });
      const res = createMockRes();

      await teamController.createInvite(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("listInvites", () => {
    it("should return list of invites", async () => {
      const invites = [{ id: "inv-1", token: "abc", role: "manager" }];
      mockListInvites.mockResolvedValueOnce(invites);

      const req = createMockReq({ params: { teamId: "team-1" } });
      const res = createMockRes();

      await teamController.listInvites(req, res);

      expect(res.json).toHaveBeenCalledWith({ data: invites });
    });

    it("should return 500 on error", async () => {
      mockListInvites.mockRejectedValueOnce(new Error("DB error"));

      const req = createMockReq({ params: { teamId: "team-1" } });
      const res = createMockRes();

      await teamController.listInvites(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("revokeInvite", () => {
    it("should return 204 when invite is revoked", async () => {
      mockRevokeInvite.mockResolvedValueOnce(true);

      const req = createMockReq({
        params: { teamId: "team-1", inviteId: "inv-1" },
      });
      const res = createMockRes();

      await teamController.revokeInvite(req, res);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it("should return 404 when invite not found", async () => {
      mockRevokeInvite.mockResolvedValueOnce(false);

      const req = createMockReq({
        params: { teamId: "team-1", inviteId: "nonexistent" },
      });
      const res = createMockRes();

      await teamController.revokeInvite(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "NOT_FOUND" }),
      );
    });
  });
});
