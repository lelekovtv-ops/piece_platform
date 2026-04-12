import { useCallback, useState } from "react";
import { useLibraryStore } from "../../stores/library-store";

interface ReferenceSelectorProps {
  maxReferences: number;
  disabled?: boolean;
  onSnapshot?: () => void;
}

interface ResolveClip {
  name: string;
  path: string;
  folder: string;
  type: string;
}

export default function ReferenceSelector({ maxReferences, disabled, onSnapshot }: ReferenceSelectorProps) {
  const { items, selectedRefs, toggleRef, clearRefs, loadItems, importFile } = useLibraryStore();
  const [resolveClips, setResolveClips] = useState<ResolveClip[]>([]);
  const [showResolvePicker, setShowResolvePicker] = useState(false);
  const [loadingResolve, setLoadingResolve] = useState(false);

  const selectedItems = items.filter((i) => selectedRefs.includes(i.id));

  const handleFromLibrary = useCallback(async () => {
    await loadItems();
    useLibraryStore.getState().setGridOpen(true);
  }, [loadItems]);

  const handleFromResolve = useCallback(async () => {
    setLoadingResolve(true);
    try {
      const clips = await window.api?.resolve.listClips();
      const mediaClips = (clips || []).filter((c) =>
        c.type.includes("video") || c.type.includes("image") ||
        c.path.match(/\.(png|jpg|jpeg|webp|mp4|mov|webm|bmp)$/i)
      );
      setResolveClips(mediaClips);
      setShowResolvePicker(true);
    } catch {
      setResolveClips([]);
    }
    setLoadingResolve(false);
  }, []);

  const handlePickResolveClip = useCallback(async (clip: ResolveClip) => {
    await importFile(clip.path);
    await loadItems();
    const updatedItems = useLibraryStore.getState().items;
    const imported = updatedItems.find((i) => i.path.includes(clip.name) || i.name.includes(clip.name));
    if (imported) {
      toggleRef(imported.id, maxReferences);
    }
    setShowResolvePicker(false);
  }, [importFile, loadItems, toggleRef, maxReferences]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-400">
          References ({selectedRefs.length}/{maxReferences})
        </span>
        {selectedRefs.length > 0 && (
          <button
            type="button"
            onClick={clearRefs}
            className="text-[10px] text-neutral-500 hover:text-neutral-300"
          >
            Clear
          </button>
        )}
      </div>

      {selectedItems.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto">
          {selectedItems.map((item) => (
            <div key={item.id} className="relative h-10 w-10 flex-shrink-0">
              {item.type === "image" ? (
                <img
                  src={`file://${item.path}`}
                  alt={item.name}
                  className="h-full w-full rounded object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded bg-neutral-800 text-[8px] text-neutral-400">
                  {item.type}
                </div>
              )}
              <button
                type="button"
                onClick={() => toggleRef(item.id, maxReferences)}
                className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-neutral-700 text-[8px] text-neutral-300 hover:bg-red-600"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleFromLibrary}
          disabled={disabled}
          className="rounded-lg border border-neutral-700 px-2.5 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
        >
          From Library
        </button>
        <button
          type="button"
          onClick={handleFromResolve}
          disabled={disabled || loadingResolve}
          className="rounded-lg border border-neutral-700 px-2.5 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
        >
          {loadingResolve ? "Loading..." : "From Resolve"}
        </button>
        {onSnapshot && (
          <button
            type="button"
            onClick={onSnapshot}
            disabled={disabled}
            className="rounded-lg border border-neutral-700 px-2.5 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
          >
            Snapshot
          </button>
        )}
      </div>

      {showResolvePicker && (
        <div className="flex flex-col gap-1 rounded-lg border border-neutral-700 bg-neutral-900 p-2 max-h-40 overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-neutral-400">Resolve Media Pool</span>
            <button
              type="button"
              onClick={() => setShowResolvePicker(false)}
              className="text-[10px] text-neutral-500 hover:text-neutral-300"
            >
              Close
            </button>
          </div>
          {resolveClips.length === 0 && (
            <span className="text-[10px] text-neutral-500 py-2 text-center">
              No media clips found in Resolve project
            </span>
          )}
          {resolveClips.map((clip, i) => (
            <button
              key={`${clip.path}-${i}`}
              type="button"
              onClick={() => handlePickResolveClip(clip)}
              className="flex items-center gap-2 rounded px-2 py-1 text-left hover:bg-neutral-800"
            >
              <span className="rounded bg-neutral-700 px-1 py-0.5 text-[8px] text-neutral-400">
                {clip.type.includes("video") ? "VID" : "IMG"}
              </span>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[11px] text-neutral-300">{clip.name}</span>
                <span className="block truncate text-[9px] text-neutral-600">{clip.folder}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
