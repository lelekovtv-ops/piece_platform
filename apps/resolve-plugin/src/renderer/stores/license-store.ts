import { create } from "zustand";

export interface LicenseState {
  hasLicense: boolean;
  tier: string | null;
  expiresAt: string | null;
  stale: boolean;
  loading: boolean;
  error: string | null;
  setLicense: (data: {
    hasLicense: boolean;
    tier: string | null;
    expiresAt: string | null;
    stale: boolean;
  }) => void;
  setLoading: () => void;
  setError: (message: string) => void;
  reset: () => void;
}

export const useLicenseStore = create<LicenseState>((set) => ({
  hasLicense: false,
  tier: null,
  expiresAt: null,
  stale: false,
  loading: true,
  error: null,
  setLicense: (data) =>
    set({
      hasLicense: data.hasLicense,
      tier: data.tier,
      expiresAt: data.expiresAt,
      stale: data.stale,
      loading: false,
      error: null,
    }),
  setLoading: () => set({ loading: true, error: null }),
  setError: (message) => set({ loading: false, error: message }),
  reset: () =>
    set({
      hasLicense: false,
      tier: null,
      expiresAt: null,
      stale: false,
      loading: true,
      error: null,
    }),
}));
