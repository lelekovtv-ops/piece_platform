import { useQueueStore } from "../../stores/queue-store";
import { PROVIDER_MAP } from "../../constants/providers";

const allProviders = Object.values(PROVIDER_MAP).flat();

function getProviderName(id: string): string {
  return allProviders.find((p) => p.id === id)?.name || id;
}

const STATUS_ICON: Record<string, string> = {
  pending: "\u23F3",
  generating: "\u26A1",
  done: "\u2705",
  error: "\u274C",
};

export default function QueueList() {
  const { items, cancel, clear } = useQueueStore();

  const activeItems = items.filter((i) => i.status !== "done" || Date.now() - i.createdAt < 60000);
  if (activeItems.length === 0) return null;

  const hasPending = items.some((i) => i.status === "pending");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-400">Queue</span>
        {hasPending && (
          <button
            type="button"
            onClick={() => clear()}
            className="text-[10px] text-neutral-500 hover:text-neutral-300"
          >
            Clear Pending
          </button>
        )}
      </div>
      {activeItems.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 rounded-lg bg-neutral-900 px-2.5 py-1.5"
        >
          <span className="text-xs">{STATUS_ICON[item.status] || "?"}</span>
          <div className="flex-1 min-w-0">
            <span className="block truncate text-[11px] text-neutral-300">
              {getProviderName(item.providerId)}
            </span>
            <span className="block truncate text-[10px] text-neutral-500">
              {item.prompt.slice(0, 40)}{item.prompt.length > 40 ? "..." : ""}
            </span>
          </div>
          {(item.status === "pending" || item.status === "generating") && (
            <button
              type="button"
              onClick={() => cancel(item.id)}
              className="text-[10px] text-neutral-500 hover:text-red-400"
            >
              Cancel
            </button>
          )}
          {item.status === "error" && item.error && (
            <span className="text-[10px] text-red-400 truncate max-w-[80px]" title={item.error}>
              {item.error}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
