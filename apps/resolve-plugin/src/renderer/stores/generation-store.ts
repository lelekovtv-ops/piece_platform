import { create } from "zustand";

export type GenerationTab = "image" | "video" | "audio";
export type GenerationStatus = "idle" | "generating" | "done" | "error";

export interface GenerationResult {
  clipName: string;
  filePath?: string;
}

interface GenerationState {
  activeTab: GenerationTab;
  prompt: string;
  provider: string | null;
  status: GenerationStatus;
  result: GenerationResult | null;
  error: string | null;
  referenceImage: string | null;
  setActiveTab: (tab: GenerationTab) => void;
  setPrompt: (prompt: string) => void;
  setProvider: (provider: string) => void;
  setGenerating: () => void;
  setResult: (result: GenerationResult) => void;
  setError: (error: string) => void;
  setReferenceImage: (path: string) => void;
  clearReferenceImage: () => void;
  reset: () => void;
}

export const useGenerationStore = create<GenerationState>((set) => ({
  activeTab: "image",
  prompt: "",
  provider: null,
  status: "idle",
  result: null,
  error: null,
  referenceImage: null,
  setActiveTab: (activeTab) => set({ activeTab }),
  setPrompt: (prompt) => set({ prompt }),
  setProvider: (provider) => set({ provider }),
  setGenerating: () => set({ status: "generating", error: null, result: null }),
  setResult: (result) => set({ status: "done", result }),
  setError: (error) => set({ status: "error", error }),
  setReferenceImage: (referenceImage) => set({ referenceImage }),
  clearReferenceImage: () => set({ referenceImage: null }),
  reset: () =>
    set({
      activeTab: "image",
      prompt: "",
      provider: null,
      status: "idle",
      result: null,
      error: null,
      referenceImage: null,
    }),
}));
