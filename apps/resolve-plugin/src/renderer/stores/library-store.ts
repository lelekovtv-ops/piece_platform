import { create } from "zustand";

interface LibraryItem {
  id: string;
  name: string;
  path: string;
  type: "image" | "video" | "audio";
  url: string | null;
  createdAt: number;
  size: number;
}

interface LibraryState {
  items: LibraryItem[];
  selectedRefs: string[];
  loading: boolean;
  gridOpen: boolean;
  loadItems: () => Promise<void>;
  toggleRef: (id: string, max: number) => void;
  clearRefs: () => void;
  importFile: (filePath: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  setGridOpen: (open: boolean) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  items: [],
  selectedRefs: [],
  loading: false,
  gridOpen: false,

  loadItems: async () => {
    set({ loading: true });
    try {
      const items = await window.api?.library.list();
      set({ items: items || [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  toggleRef: (id, max) => {
    const { selectedRefs } = get();
    if (selectedRefs.includes(id)) {
      set({ selectedRefs: selectedRefs.filter((r) => r !== id) });
    } else if (selectedRefs.length < max) {
      set({ selectedRefs: [...selectedRefs, id] });
    }
  },

  clearRefs: () => set({ selectedRefs: [] }),

  importFile: async (filePath) => {
    await window.api?.library.import(filePath);
    await get().loadItems();
  },

  removeItem: async (id) => {
    await window.api?.library.remove(id);
    const { selectedRefs } = get();
    set({ selectedRefs: selectedRefs.filter((r) => r !== id) });
    await get().loadItems();
  },

  setGridOpen: (gridOpen) => set({ gridOpen }),
}));
