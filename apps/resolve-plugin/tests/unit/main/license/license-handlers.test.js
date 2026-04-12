import { vi, describe, it, expect, beforeEach } from "vitest";

const mockCheckLicense = vi.fn();

const mockLicenseCheck = { checkLicense: mockCheckLicense };

const { registerLicenseHandlers } =
  await import("../../../../src/main/ipc/license-handlers.js");

describe("license-handlers", () => {
  let handlers;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = {};
    registerLicenseHandlers(handlers, { licenseCheck: mockLicenseCheck });
  });

  it("registers license:check handler", () => {
    expect(handlers["license:check"]).toBeTypeOf("function");
  });

  it("registers license:refresh handler", () => {
    expect(handlers["license:refresh"]).toBeTypeOf("function");
  });

  it("license:check calls checkLicense without force", async () => {
    mockCheckLicense.mockResolvedValue({
      hasLicense: true,
      tier: "pro",
      expiresAt: null,
      stale: false,
    });

    const result = await handlers["license:check"]();

    expect(mockCheckLicense).toHaveBeenCalledWith();
    expect(result.hasLicense).toBe(true);
  });

  it("license:refresh calls checkLicense with force:true", async () => {
    mockCheckLicense.mockResolvedValue({
      hasLicense: true,
      tier: "pro",
      expiresAt: null,
      stale: false,
    });

    const result = await handlers["license:refresh"]();

    expect(mockCheckLicense).toHaveBeenCalledWith({ force: true });
    expect(result.hasLicense).toBe(true);
  });

  it("license:check returns error state on failure", async () => {
    mockCheckLicense.mockRejectedValue(new Error("Unexpected"));

    const result = await handlers["license:check"]();

    expect(result).toEqual({
      hasLicense: false,
      tier: null,
      expiresAt: null,
      stale: false,
      error: "Unexpected",
    });
  });
});
