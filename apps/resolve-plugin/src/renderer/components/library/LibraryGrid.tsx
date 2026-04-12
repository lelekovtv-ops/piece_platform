import { useLibraryStore } from "../../stores/library-store";

interface LibraryGridProps {
  onClose: () => void;
}

const TYPE_BADGE: Record<string, string> = {
  image: "IMG",
  video: "VID",
  audio: "AUD",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

export default function LibraryGrid({ onClose }: LibraryGridProps) {
  const { items, loading, removeItem, loadItems } = useLibraryStore();

  const handleImport = async () => {
    // No native file dialog in this Electron setup — user imports via drag or external path
    // For now, refresh the list to pick up any new files
    await loadItems();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-neutral-950/95 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5">
        <span className="text-sm font-medium text-neutral-200">Media Library</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleImport}
            className="rounded-lg border border-neutral-700 px-2.5 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-neutral-500">Loading...</span>
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-neutral-500">
              No media files yet. Generate something or capture a snapshot.
            </span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <div key={item.id} className="group relative rounded-lg overflow-hidden bg-neutral-900">
              {item.type === "image" ? (
                <img
                  src={`file://${item.path}`}
                  alt={item.name}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-neutral-800">
                  <span className="text-xs text-neutral-500">{TYPE_BADGE[item.type]}</span>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-neutral-400">{formatSize(item.size)}</span>
                  <span className="rounded bg-neutral-700/80 px-1 py-0.5 text-[8px] text-neutral-300">
                    {TYPE_BADGE[item.type]}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="absolute right-1 top-1 hidden rounded bg-red-600/80 p-0.5 text-white group-hover:block"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
