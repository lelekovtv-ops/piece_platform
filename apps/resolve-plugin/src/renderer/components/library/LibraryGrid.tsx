import { useState } from "react";
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

interface PreviewItem {
  path: string;
  type: "image" | "video" | "audio";
  name: string;
}

function MediaPreview({ item, onClose }: { item: PreviewItem; onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-60 flex flex-col items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 rounded-full bg-neutral-800 p-1.5 text-neutral-400 hover:bg-neutral-700 hover:text-white"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="max-h-[85%] max-w-[95%]" onClick={(e) => e.stopPropagation()}>
        {item.type === "image" && (
          <img
            src={`file://${item.path}`}
            alt={item.name}
            className="max-h-[80vh] rounded-lg object-contain"
          />
        )}
        {item.type === "video" && (
          <video
            src={`file://${item.path}`}
            controls
            autoPlay
            className="max-h-[80vh] rounded-lg"
          />
        )}
        {item.type === "audio" && (
          <div className="flex flex-col items-center gap-4 rounded-xl bg-neutral-900 p-8">
            <span className="text-sm text-neutral-300">{item.name}</span>
            <audio src={`file://${item.path}`} controls autoPlay className="w-72" />
          </div>
        )}
      </div>

      <span className="mt-3 text-xs text-neutral-500">{item.name}</span>
    </div>
  );
}

export default function LibraryGrid({ onClose }: LibraryGridProps) {
  const { items, loading, removeItem, loadItems } = useLibraryStore();
  const [preview, setPreview] = useState<PreviewItem | null>(null);

  const handleImport = async () => {
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
              <button
                type="button"
                className="w-full"
                onClick={() => setPreview({ path: item.path, type: item.type, name: item.name })}
              >
                {item.type === "image" ? (
                  <img
                    src={`file://${item.path}`}
                    alt={item.name}
                    className="aspect-square w-full object-cover"
                  />
                ) : item.type === "video" ? (
                  <div className="relative aspect-square w-full bg-neutral-800">
                    <video
                      src={`file://${item.path}`}
                      className="h-full w-full object-cover"
                      muted
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-full bg-black/60 p-2">
                        <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-neutral-800">
                    <svg className="h-6 w-6 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                    </svg>
                  </div>
                )}
              </button>
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
                onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
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

      {preview && <MediaPreview item={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
