import { create } from "zustand";

interface KeysState {
  keys: Record<string, string>;
  setKey: (provider: string, apiKey: string) => void;
  removeKey: (provider: string) => void;
  getKey: (provider: string) => string;
  loadKeys: (keys: Record<string, string>) => void;
  reset: () => void;
}

export const useKeysStore = create<KeysState>((set, get) => ({
  keys: {},
  setKey: (provider, apiKey) =>
    set((state) => ({ keys: { ...state.keys, [provider]: apiKey } })),
  removeKey: (provider) =>
    set((state) => {
      const { [provider]: _, ...rest } = state.keys;
      return { keys: rest };
    }),
  getKey: (provider) => get().keys[provider] || "",
  loadKeys: (keys) => set({ keys: { ...keys } }),
  reset: () => set({ keys: {} }),
}));
