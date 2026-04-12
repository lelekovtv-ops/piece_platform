import { describe, it, expect, beforeEach } from "vitest";
import { useLicenseStore } from "../../../../src/renderer/stores/license-store.ts";

describe("license-store", () => {
  beforeEach(() => {
    useLicenseStore.getState().reset();
  });

  it("starts with loading:true and hasLicense:false", () => {
    const state = useLicenseStore.getState();
    expect(state.loading).toBe(true);
    expect(state.hasLicense).toBe(false);
    expect(state.tier).toBeNull();
  });

  it("setLicense updates all fields and clears loading", () => {
    useLicenseStore.getState().setLicense({
      hasLicense: true,
      tier: "pro",
      expiresAt: "2027-01-01T00:00:00.000Z",
      stale: false,
    });

    const state = useLicenseStore.getState();
    expect(state.hasLicense).toBe(true);
    expect(state.tier).toBe("pro");
    expect(state.expiresAt).toBe("2027-01-01T00:00:00.000Z");
    expect(state.stale).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("setLoading sets loading:true", () => {
    useLicenseStore.getState().setLicense({
      hasLicense: true,
      tier: "pro",
      expiresAt: null,
      stale: false,
    });
    useLicenseStore.getState().setLoading();

    expect(useLicenseStore.getState().loading).toBe(true);
    expect(useLicenseStore.getState().error).toBeNull();
  });

  it("setError sets error and clears loading", () => {
    useLicenseStore.getState().setError("Network failure");

    const state = useLicenseStore.getState();
    expect(state.error).toBe("Network failure");
    expect(state.loading).toBe(false);
  });

  it("reset returns to initial state", () => {
    useLicenseStore.getState().setLicense({
      hasLicense: true,
      tier: "pro",
      expiresAt: "2027-01-01",
      stale: false,
    });
    useLicenseStore.getState().reset();

    const state = useLicenseStore.getState();
    expect(state.hasLicense).toBe(false);
    expect(state.tier).toBeNull();
    expect(state.loading).toBe(true);
  });
});
