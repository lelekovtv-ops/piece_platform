import { vi, describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  unlink: vi.fn(),
  mkdir: vi.fn(),
  chmod: vi.fn(),
  stat: vi.fn(),
}));

vi.mock("node:crypto", async () => {
  const actual = await vi.importActual("node:crypto");
  return { ...actual, randomBytes: vi.fn((n) => Buffer.alloc(n, 0xab)) };
});

describe("Token Storage", () => {
  let tokenStorage;
  let fsp;
  const DATA_DIR = "/tmp/test-piece-studio";

  beforeEach(async () => {
    vi.resetModules();
    fsp = await import("node:fs/promises");
    tokenStorage = await import("../../../../src/main/auth/token-storage.js");
  });

  describe("getOrCreateKey", () => {
    it("should read existing keyfile", async () => {
      const hexKey = "ab".repeat(32);
      vi.mocked(fsp.readFile).mockResolvedValue(hexKey);

      const key = await tokenStorage.getOrCreateKey(DATA_DIR);
      expect(key).toBe(hexKey);
      expect(fsp.readFile).toHaveBeenCalledWith(
        join(DATA_DIR, ".keyfile"),
        "utf-8",
      );
    });

    it("should generate key when file missing", async () => {
      const err = new Error("ENOENT");
      err.code = "ENOENT";
      vi.mocked(fsp.readFile).mockRejectedValue(err);
      vi.mocked(fsp.writeFile).mockResolvedValue(undefined);
      vi.mocked(fsp.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsp.chmod).mockResolvedValue(undefined);

      const key = await tokenStorage.getOrCreateKey(DATA_DIR);
      expect(key).toBe("ab".repeat(32));
      expect(fsp.writeFile).toHaveBeenCalledWith(
        join(DATA_DIR, ".keyfile"),
        expect.any(String),
        "utf-8",
      );
      expect(fsp.chmod).toHaveBeenCalledWith(join(DATA_DIR, ".keyfile"), 0o600);
    });
  });

  describe("saveToken / loadToken", () => {
    it("should encrypt and save, then load and decrypt", async () => {
      const token = {
        accessToken: "desktop_abc123",
        user: { id: "u1", email: "a@b.com" },
      };
      const hexKey = "ab".repeat(32);

      vi.mocked(fsp.readFile).mockResolvedValueOnce(hexKey);
      vi.mocked(fsp.writeFile).mockResolvedValue(undefined);
      vi.mocked(fsp.rename).mockResolvedValue(undefined);
      vi.mocked(fsp.mkdir).mockResolvedValue(undefined);

      await tokenStorage.saveToken(DATA_DIR, token);

      expect(fsp.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(".tmp"),
        expect.any(String),
        "utf-8",
      );
      expect(fsp.rename).toHaveBeenCalled();

      const savedEncrypted = vi.mocked(fsp.writeFile).mock.calls[0][1];
      vi.mocked(fsp.readFile)
        .mockResolvedValueOnce(hexKey)
        .mockResolvedValueOnce(savedEncrypted);

      const loaded = await tokenStorage.loadToken(DATA_DIR);
      expect(loaded).toEqual(token);
    });
  });

  describe("loadToken (corrupted/missing)", () => {
    it("should return null when auth file missing", async () => {
      const hexKey = "ab".repeat(32);
      vi.mocked(fsp.readFile).mockResolvedValueOnce(hexKey);

      const err = new Error("ENOENT");
      err.code = "ENOENT";
      vi.mocked(fsp.readFile).mockRejectedValueOnce(err);

      const result = await tokenStorage.loadToken(DATA_DIR);
      expect(result).toBeNull();
    });

    it("should return null on corrupted data", async () => {
      const hexKey = "ab".repeat(32);
      vi.mocked(fsp.readFile).mockResolvedValueOnce(hexKey);
      vi.mocked(fsp.readFile).mockResolvedValueOnce("not-valid-encrypted-data");

      const result = await tokenStorage.loadToken(DATA_DIR);
      expect(result).toBeNull();
    });
  });

  describe("clearToken", () => {
    it("should delete auth file", async () => {
      vi.mocked(fsp.unlink).mockResolvedValue(undefined);

      await tokenStorage.clearToken(DATA_DIR);
      expect(fsp.unlink).toHaveBeenCalledWith(join(DATA_DIR, "auth.enc"));
    });

    it("should not throw when file already missing", async () => {
      const err = new Error("ENOENT");
      err.code = "ENOENT";
      vi.mocked(fsp.unlink).mockRejectedValue(err);

      await expect(tokenStorage.clearToken(DATA_DIR)).resolves.toBeUndefined();
    });
  });
});
