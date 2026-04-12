import { vi, describe, it, expect, beforeEach } from "vitest";

describe("Provider Registry", () => {
  let registry;

  beforeEach(async () => {
    vi.resetModules();
    registry = await import("../../../../src/main/providers/registry.js");
  });

  describe("registerProvider", () => {
    it("should register a provider", () => {
      const provider = {
        id: "test-image",
        name: "Test Image",
        kind: "image",
        generate: vi.fn(),
      };
      registry.registerProvider(provider);
      expect(registry.getProvider("test-image")).toBe(provider);
    });

    it("should throw on duplicate registration", () => {
      const provider = {
        id: "dup",
        name: "Dup",
        kind: "image",
        generate: vi.fn(),
      };
      registry.registerProvider(provider);
      expect(() => registry.registerProvider(provider)).toThrow(
        'Provider "dup" is already registered',
      );
    });

    it("should throw when id is missing", () => {
      expect(() =>
        registry.registerProvider({
          name: "No ID",
          kind: "image",
          generate: vi.fn(),
        }),
      ).toThrow("Provider must have an id");
    });

    it("should throw when generate is not a function", () => {
      expect(() =>
        registry.registerProvider({ id: "bad", name: "Bad", kind: "image" }),
      ).toThrow("Provider must have a generate function");
    });
  });

  describe("getProvider", () => {
    it("should return undefined for unknown provider", () => {
      expect(registry.getProvider("nonexistent")).toBeUndefined();
    });
  });

  describe("listProviders", () => {
    it("should list all providers when no kind filter", () => {
      registry.registerProvider({
        id: "img1",
        name: "Img1",
        kind: "image",
        generate: vi.fn(),
      });
      registry.registerProvider({
        id: "vid1",
        name: "Vid1",
        kind: "video",
        generate: vi.fn(),
      });
      const all = registry.listProviders();
      expect(all).toHaveLength(2);
    });

    it("should filter by kind", () => {
      registry.registerProvider({
        id: "img1",
        name: "Img1",
        kind: "image",
        generate: vi.fn(),
      });
      registry.registerProvider({
        id: "vid1",
        name: "Vid1",
        kind: "video",
        generate: vi.fn(),
      });
      expect(registry.listProviders("image")).toHaveLength(1);
      expect(registry.listProviders("image")[0].id).toBe("img1");
      expect(registry.listProviders("video")).toHaveLength(1);
      expect(registry.listProviders("audio")).toHaveLength(0);
    });
  });

  describe("clearRegistry", () => {
    it("should remove all providers", () => {
      registry.registerProvider({
        id: "tmp",
        name: "Tmp",
        kind: "image",
        generate: vi.fn(),
      });
      registry.clearRegistry();
      expect(registry.listProviders()).toHaveLength(0);
    });
  });
});
