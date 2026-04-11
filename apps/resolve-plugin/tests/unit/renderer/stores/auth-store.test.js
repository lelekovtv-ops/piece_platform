import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../../../../src/renderer/stores/auth-store";

describe("Auth Store", () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
  });

  it("should start in checking status", () => {
    const state = useAuthStore.getState();
    expect(state.status).toBe("checking");
    expect(state.user).toBeNull();
  });

  it("setUser should transition to authenticated", () => {
    useAuthStore.getState().setUser({ id: "u1", email: "a@b.com" });
    const state = useAuthStore.getState();
    expect(state.status).toBe("authenticated");
    expect(state.user).toEqual({ id: "u1", email: "a@b.com" });
    expect(state.userCode).toBeNull();
  });

  it("setDeviceCode should transition to awaiting-code", () => {
    useAuthStore.getState().setDeviceCode({
      userCode: "ABCD-1234",
      deviceCode: "dev_1",
      verificationUri: "https://app.piece.app/device",
      expiresIn: 900,
      interval: 5,
    });
    const state = useAuthStore.getState();
    expect(state.status).toBe("awaiting-code");
    expect(state.userCode).toBe("ABCD-1234");
    expect(state.verificationUri).toBe("https://app.piece.app/device");
    expect(state.expiresAt).toBeTypeOf("number");
  });

  it("setError should transition to error", () => {
    useAuthStore.getState().setError("Token expired");
    const state = useAuthStore.getState();
    expect(state.status).toBe("error");
    expect(state.error).toBe("Token expired");
  });

  it("setUnauthenticated should clear user and codes", () => {
    useAuthStore.getState().setUser({ id: "u1", email: "a@b.com" });
    useAuthStore.getState().setUnauthenticated();
    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.user).toBeNull();
    expect(state.userCode).toBeNull();
  });

  it("reset should return to initial state", () => {
    useAuthStore.getState().setUser({ id: "u1", email: "a@b.com" });
    useAuthStore.getState().reset();
    const state = useAuthStore.getState();
    expect(state.status).toBe("checking");
    expect(state.user).toBeNull();
  });
});
