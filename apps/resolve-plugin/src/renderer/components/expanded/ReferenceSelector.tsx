import { useCallback } from "react";
import { useLibraryStore } from "../../stores/library-store";

interface ReferenceSelectorProps {
  maxReferences: number;
  disabled?: boolean;
  onSnapshot?: () => void;
}

export default function ReferenceSelector({ maxReferences, disabled, onSnapshot }: ReferenceSelectorProps) {
  const { items, selectedRefs, toggleRef, clearRefs, loadItems } = useLibraryStore();

  const selectedItems = items.filter((i) => selectedRefs.includes(i.id));

  const handleFromLibrary = useCallback(async () => {
    await loadItems();
    useLibraryStore.getState().setGridOpen(true);
  }, [loadItems]);

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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleFromLibrary}
          disabled={disabled}
          className="rounded-lg border border-neutral-700 px-2.5 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
        >
          From Library
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
    </div>
  );
}
