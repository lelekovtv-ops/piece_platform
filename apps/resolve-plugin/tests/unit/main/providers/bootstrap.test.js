import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../../../src/main/providers/registry.js", () => ({
  registerProvider: vi.fn(),
  listProviders: vi.fn(() => []),
}));

describe("Provider Bootstrap", () => {
  let registerProvider;

  beforeEach(async () => {
    vi.resetModules();
    const reg = await import("../../../../src/main/providers/registry.js");
    registerProvider = reg.registerProvider;
    vi.mocked(registerProvider).mockReset();
  });

  it("should register all providers", async () => {
    await import("../../../../src/main/providers/bootstrap.js");

    const ids = vi.mocked(registerProvider).mock.calls.map((c) => c[0].id);
    expect(ids).toContain("sjinn");
    expect(ids).toContain("gemini");
    expect(ids).toContain("fal-flux-schnell");
    expect(ids).toContain("fal-flux-pro");
    expect(ids).toContain("fal-kling-v2");
    expect(ids).toContain("fal-veo3");
    expect(ids).toContain("fal-luma");
    expect(ids).toContain("fal-elevenlabs");
    expect(ids).toContain("fal-stable-audio");
    expect(ids).toContain("fish-audio");
    expect(registerProvider).toHaveBeenCalledTimes(10);
  });
});
