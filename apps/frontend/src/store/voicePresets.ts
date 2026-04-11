import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  VoiceProvider,
  ProviderSettings,
  VoiceConfig,
} from "@/lib/bibleParser";

export interface VoicePreset {
  id: string;
  name: string;
  provider: VoiceProvider;
  voiceId: string;
  voiceName: string;
  settings: ProviderSettings;
  previewUrl?: string;
  createdAt: string;
}

interface VoicePresetsState {
  presets: VoicePreset[];
  addPreset: (name: string, config: VoiceConfig) => string;
  removePreset: (id: string) => void;
  toVoiceConfig: (presetId: string) => VoiceConfig | null;
}

function safeStorage(): Storage | undefined {
  try {
    if (typeof window !== "undefined") return window.localStorage;
  } catch {
    /* SSR */
  }
  return undefined;
}

export const useVoicePresetsStore = create<VoicePresetsState>()(
  persist(
    (set, get) => ({
      presets: [],

      addPreset: (name, config) => {
        const id = `vp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const preset: VoicePreset = {
          id,
          name,
          provider: config.provider,
          voiceId: config.voiceId,
          voiceName: config.voiceName,
          settings: config.settings,
          previewUrl: config.previewUrl,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ presets: [...state.presets, preset] }));
        return id;
      },

      removePreset: (id) =>
        set((state) => ({
          presets: state.presets.filter((p) => p.id !== id),
        })),

      toVoiceConfig: (presetId) => {
        const preset = get().presets.find((p) => p.id === presetId);
        if (!preset) return null;
        return {
          provider: preset.provider,
          voiceId: preset.voiceId,
          voiceName: preset.voiceName,
          settings: preset.settings,
          previewUrl: preset.previewUrl,
        };
      },
    }),
    {
      name: "piece-voice-presets",
      storage: createJSONStorage(() => safeStorage()!),
      partialize: (state) => ({ presets: state.presets }),
    },
  ),
);
