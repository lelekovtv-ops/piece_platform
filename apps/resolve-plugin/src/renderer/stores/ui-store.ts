import { create } from "zustand";

export type WindowMode = "bubble" | "expanded";
export type BubbleState = "idle" | "generating" | "success" | "error";

interface UiState {
  mode: WindowMode;
  bubbleState: BubbleState;
  setMode: (mode: WindowMode) => void;
  setBubbleState: (state: BubbleState) => void;
  reset: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  mode: "expanded",
  bubbleState: "idle",
  setMode: (mode) => set({ mode }),
  setBubbleState: (bubbleState) => set({ bubbleState }),
  reset: () => set({ mode: "expanded", bubbleState: "idle" }),
}));
