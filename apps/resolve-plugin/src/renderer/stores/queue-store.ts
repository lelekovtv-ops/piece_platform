import { create } from "zustand";

interface QueueItem {
  id: string;
  providerId: string;
  prompt: string;
  apiKey: string;
  duration: number | null;
  referenceImages: string[];
  status: "pending" | "generating" | "done" | "error";
  result: { clipName: string; filePath: string } | null;
  error: string | null;
  createdAt: number;
}

interface QueueState {
  items: QueueItem[];
  initialized: boolean;
  setItems: (items: QueueItem[]) => void;
  add: (input: {
    providerId: string;
    prompt: string;
    apiKey: string;
    duration?: number;
    referenceImages?: string[];
  }) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  loadItems: () => Promise<void>;
  initListener: () => void;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  initialized: false,

  setItems: (items) => set({ items }),

  add: async (input) => {
    const items = await window.api?.queue.add(input);
    if (items) set({ items });
  },

  cancel: async (id) => {
    const items = await window.api?.queue.cancel(id);
    if (items) set({ items });
  },

  clear: async () => {
    const items = await window.api?.queue.clear();
    if (items) set({ items });
  },

  loadItems: async () => {
    const items = await window.api?.queue.list();
    if (items) set({ items });
  },

  initListener: () => {
    if (get().initialized) return;
    set({ initialized: true });
    window.api?.queue.onUpdate((items) => {
      set({ items });
    });
  },
}));
