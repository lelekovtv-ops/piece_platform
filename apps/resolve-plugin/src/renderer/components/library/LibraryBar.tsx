import { useEffect } from "react";
import { useLibraryStore } from "../../stores/library-store";
import LibraryGrid from "./LibraryGrid";

interface LibraryBarProps {
  selectionMode?: boolean;
  maxReferences?: number;
}

export default function LibraryBar({ selectionMode, maxReferences = 0 }: LibraryBarProps) {
  const { items, loading, gridOpen, selectedRefs, loadItems, toggleRef, setGridOpen } = useLibraryStore();

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  return (
    <>
      <div className="flex h-12 items-center gap-2 border-t border-neutral-800 bg-neutral-950 px-3">
        <button
          type="button"
          onClick={() => setGridOpen(true)}
          className="text-[10px] font-medium text-neutral-500 hover:text-neutral-300 whitespace-nowrap"
        >
          Library
        </button>
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
          {loading && <span className="text-[10px] text-neutral-600">Loading...</span>}
          {!loading && items.length === 0 && (
            <span className="text-[10px] text-neutral-600">No media yet</span>
          )}
          {items.slice(0, 20).map((item) => {
            const isSelected = selectedRefs.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (selectionMode && maxReferences > 0) {
                    toggleRef(item.id, maxReferences);
                  } else {
                    setGridOpen(true);
                  }
                }}
                className={`relative h-8 w-8 flex-shrink-0 rounded overflow-hidden border ${
                  isSelected ? "border-violet-500" : "border-transparent"
                }`}
              >
                {item.type === "image" ? (
                  <img
                    src={`file://${item.path}`}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-neutral-800 text-[7px] text-neutral-500">
                    {item.type === "video" ? "VID" : "AUD"}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {gridOpen && <LibraryGrid onClose={() => setGridOpen(false)} />}
    </>
  );
}
