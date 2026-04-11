import { create } from "zustand";

export type AuthStatus =
  | "checking"
  | "unauthenticated"
  | "awaiting-code"
  | "authenticated"
  | "error";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface DeviceCodeInfo {
  userCode: string;
  deviceCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  userCode: string | null;
  verificationUri: string | null;
  expiresAt: number | null;
  error: string | null;

  setUser: (user: AuthUser) => void;
  setDeviceCode: (info: DeviceCodeInfo) => void;
  setError: (message: string) => void;
  setChecking: () => void;
  setUnauthenticated: () => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "checking",
  userCode: null,
  verificationUri: null,
  expiresAt: null,
  error: null,

  setUser: (user) =>
    set({
      user,
      status: "authenticated",
      userCode: null,
      verificationUri: null,
      error: null,
    }),

  setDeviceCode: (info) =>
    set({
      status: "awaiting-code",
      userCode: info.userCode,
      verificationUri: info.verificationUri,
      expiresAt: Date.now() + info.expiresIn * 1000,
      error: null,
    }),

  setError: (message) => set({ status: "error", error: message }),

  setChecking: () => set({ status: "checking" }),

  setUnauthenticated: () =>
    set({
      user: null,
      status: "unauthenticated",
      userCode: null,
      verificationUri: null,
      expiresAt: null,
      error: null,
    }),

  reset: () =>
    set({
      user: null,
      status: "checking",
      userCode: null,
      verificationUri: null,
      expiresAt: null,
      error: null,
    }),
}));
