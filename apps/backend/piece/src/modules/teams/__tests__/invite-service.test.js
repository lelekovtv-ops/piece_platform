import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFindOne = vi.fn();
const mockFind = vi.fn();
const mockInsertOne = vi.fn();
const mockDeleteOne = vi.fn();
const mockToArray = vi.fn();

const mockInvitesCollection = {
  findOne: mockFindOne,
  find: mockFind.mockReturnValue({ toArray: mockToArray }),
  insertOne: mockInsertOne,
  deleteOne: mockDeleteOne,
};

const mockMembersCollection = {
  findOne: vi.fn(),
  insertOne: vi.fn(),
};

vi.mock("@piece/multitenancy", () => ({
  getGlobalSystemCollection: vi.fn((name) => {
    if (name === "team_invites") return mockInvitesCollection;
    if (name === "team_members") return mockMembersCollection;
    return mockInvitesCollection;
  }),
}));

vi.mock("@piece/validation/mongo", () => ({
  mongoIdUtils: {
    toObjectId: vi.fn((id) => id),
    toApiString: vi.fn((id) => id?.toString?.() ?? id),
    isValid: vi.fn(() => true),
  },
}));

vi.mock("../../../utils/logger.js", () => ({
  createComponentLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("../service.js", () => ({
  teamService: {
    addMember: vi
      .fn()
      .mockResolvedValue({
        teamId: "team-1",
        userId: "user-2",
        role: "manager",
        joinedAt: new Date(),
      }),
    getById: vi.fn().mockResolvedValue({ id: "team-1", name: "Test Team" }),
  },
}));

const { inviteService } = await import("../invite-service.js");

describe("InviteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockReturnValue({ toArray: mockToArray });
  });

  describe("createInvite", () => {
    it("should create an invite with a token", async () => {
      mockInsertOne.mockResolvedValueOnce({ insertedId: "invite-1" });

      const result = await inviteService.createInvite(
        "team-1",
        "manager",
        "user-1",
      );

      expect(result).toHaveProperty("token");
      expect(result.token).toHaveLength(64);
      expect(result.teamId).toBe("team-1");
      expect(result.role).toBe("manager");
      expect(result.createdBy).toBe("user-1");
      expect(mockInsertOne).toHaveBeenCalledTimes(1);
    });

    it("should create an invite with admin role", async () => {
      mockInsertOne.mockResolvedValueOnce({ insertedId: "invite-2" });

      const result = await inviteService.createInvite(
        "team-1",
        "admin",
        "user-1",
      );

      expect(result.role).toBe("admin");
    });

    it("should reject invalid roles", async () => {
      await expect(
        inviteService.createInvite("team-1", "owner", "user-1"),
      ).rejects.toThrow();
    });
  });

  describe("listInvites", () => {
    it("should return all invites for a team", async () => {
      const invites = [
        {
          _id: "inv-1",
          token: "abc",
          teamId: "team-1",
          role: "manager",
          createdBy: "user-1",
          createdAt: new Date(),
        },
        {
          _id: "inv-2",
          token: "def",
          teamId: "team-1",
          role: "admin",
          createdBy: "user-1",
          createdAt: new Date(),
        },
      ];
      mockToArray.mockResolvedValueOnce(invites);

      const result = await inviteService.listInvites("team-1");

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("token");
      expect(result[0]).toHaveProperty("role");
    });

    it("should return empty array when no invites exist", async () => {
      mockToArray.mockResolvedValueOnce([]);

      const result = await inviteService.listInvites("team-1");

      expect(result).toEqual([]);
    });
  });

  describe("revokeInvite", () => {
    it("should delete an invite by id and teamId", async () => {
      mockDeleteOne.mockResolvedValueOnce({ deletedCount: 1 });

      const result = await inviteService.revokeInvite("team-1", "invite-1");

      expect(result).toBe(true);
      expect(mockDeleteOne).toHaveBeenCalledTimes(1);
    });

    it("should return false when invite not found", async () => {
      mockDeleteOne.mockResolvedValueOnce({ deletedCount: 0 });

      const result = await inviteService.revokeInvite("team-1", "nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("getInviteByToken", () => {
    it("should find an invite by token", async () => {
      const invite = {
        _id: "inv-1",
        token: "abc123",
        teamId: "team-1",
        role: "manager",
        createdBy: "user-1",
        createdAt: new Date(),
      };
      mockFindOne.mockResolvedValueOnce(invite);

      const result = await inviteService.getInviteByToken("abc123");

      expect(result).toHaveProperty("id");
      expect(result.token).toBe("abc123");
      expect(result.teamId).toBe("team-1");
    });

    it("should return null for invalid token", async () => {
      mockFindOne.mockResolvedValueOnce(null);

      const result = await inviteService.getInviteByToken("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("acceptInvite", () => {
    it("should accept an invite and add user to team", async () => {
      const invite = {
        _id: "inv-1",
        token: "valid-token",
        teamId: "team-1",
        role: "manager",
        createdBy: "user-1",
        createdAt: new Date(),
      };
      mockFindOne.mockResolvedValueOnce(invite);

      const { teamService } = await import("../service.js");

      const result = await inviteService.acceptInvite("valid-token", "user-2");

      expect(teamService.addMember).toHaveBeenCalledWith(
        "team-1",
        "user-2",
        "manager",
      );
      expect(result).toHaveProperty("team");
    });

    it("should throw for invalid token", async () => {
      mockFindOne.mockResolvedValueOnce(null);

      await expect(
        inviteService.acceptInvite("bad-token", "user-2"),
      ).rejects.toThrow();
    });

    it("should handle user already being a member", async () => {
      const invite = {
        _id: "inv-1",
        token: "valid-token",
        teamId: "team-1",
        role: "manager",
        createdBy: "user-1",
        createdAt: new Date(),
      };
      mockFindOne.mockResolvedValueOnce(invite);

      const { teamService } = await import("../service.js");
      const alreadyMemberError = new Error(
        "User is already a member of this team",
      );
      alreadyMemberError.code = "ALREADY_MEMBER";
      teamService.addMember.mockRejectedValueOnce(alreadyMemberError);

      await expect(
        inviteService.acceptInvite("valid-token", "user-2"),
      ).rejects.toThrow("User is already a member of this team");
    });
  });
});
