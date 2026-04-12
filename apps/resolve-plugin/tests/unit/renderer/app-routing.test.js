import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../../../src/renderer/stores/auth-store.ts";
import { useLicenseStore } from "../../../src/renderer/stores/license-store.ts";

describe("App init flow", () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    useLicenseStore.getState().reset();
  });

  it("starts with auth checking and license loading", () => {
    expect(useAuthStore.getState().status).toBe("checking");
    expect(useLicenseStore.getState().loading).toBe(true);
  });

  it("sets unauthenticated when no user found", () => {
    useAuthStore.getState().setUnauthenticated();
    useLicenseStore.getState().setLicense({
      hasLicense: false,
      tier: null,
      expiresAt: null,
      stale: false,
    });

    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(useLicenseStore.getState().hasLicense).toBe(false);
    expect(useLicenseStore.getState().loading).toBe(false);
  });

  it("sets authenticated + licensed when user and license found", () => {
    useAuthStore.getState().setUser({
      id: "u1",
      email: "user@test.com",
      name: "Test",
    });

    useLicenseStore.getState().setLicense({
      hasLicense: true,
      tier: "pro",
      expiresAt: "2027-01-01T00:00:00.000Z",
      stale: false,
    });

    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useLicenseStore.getState().hasLicense).toBe(true);
    expect(useLicenseStore.getState().tier).toBe("pro");
    expect(useLicenseStore.getState().loading).toBe(false);
  });

  it("sets authenticated + no license when user found but no license", () => {
    useAuthStore.getState().setUser({
      id: "u1",
      email: "user@test.com",
    });

    useLicenseStore.getState().setLicense({
      hasLicense: false,
      tier: null,
      expiresAt: null,
      stale: false,
    });

    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useLicenseStore.getState().hasLicense).toBe(false);
  });

  it("handles stale license from cache (offline)", () => {
    useAuthStore.getState().setUser({
      id: "u1",
      email: "user@test.com",
    });

    useLicenseStore.getState().setLicense({
      hasLicense: true,
      tier: "pro",
      expiresAt: "2027-01-01T00:00:00.000Z",
      stale: true,
    });

    const license = useLicenseStore.getState();
    expect(license.hasLicense).toBe(true);
    expect(license.stale).toBe(true);
  });

  describe("routing decision", () => {
    function getScreen() {
      const authStatus = useAuthStore.getState().status;
      const { hasLicense, loading } = useLicenseStore.getState();

      if (authStatus === "checking") return "loading";
      if (authStatus !== "authenticated") return "device-code";
      if (loading) return "loading";
      if (!hasLicense) return "upgrade";
      return "main";
    }

    it("shows loading when auth is checking", () => {
      expect(getScreen()).toBe("loading");
    });

    it("shows device-code when unauthenticated", () => {
      useAuthStore.getState().setUnauthenticated();
      expect(getScreen()).toBe("device-code");
    });

    it("shows loading when authenticated but license loading", () => {
      useAuthStore.getState().setUser({ id: "u1", email: "a@b.com" });
      // license store starts with loading: true
      expect(getScreen()).toBe("loading");
    });

    it("shows upgrade when authenticated but no license", () => {
      useAuthStore.getState().setUser({ id: "u1", email: "a@b.com" });
      useLicenseStore.getState().setLicense({
        hasLicense: false,
        tier: null,
        expiresAt: null,
        stale: false,
      });
      expect(getScreen()).toBe("upgrade");
    });

    it("shows main when authenticated and licensed", () => {
      useAuthStore.getState().setUser({ id: "u1", email: "a@b.com" });
      useLicenseStore.getState().setLicense({
        hasLicense: true,
        tier: "pro",
        expiresAt: "2027-01-01",
        stale: false,
      });
      expect(getScreen()).toBe("main");
    });

    it("shows main when license is stale but valid", () => {
      useAuthStore.getState().setUser({ id: "u1", email: "a@b.com" });
      useLicenseStore.getState().setLicense({
        hasLicense: true,
        tier: "pro",
        expiresAt: "2027-01-01",
        stale: true,
      });
      expect(getScreen()).toBe("main");
    });

    it("shows device-code for error status", () => {
      useAuthStore.getState().setError("Token expired");
      expect(getScreen()).toBe("device-code");
    });

    it("shows device-code for awaiting-code status", () => {
      useAuthStore.getState().setDeviceCode({
        userCode: "ABCD-1234",
        deviceCode: "dc",
        verificationUri: "https://example.com",
        expiresIn: 600,
        interval: 5,
      });
      expect(getScreen()).toBe("device-code");
    });
  });
});
