interface StatusDisplayProps {
  status: "idle" | "generating" | "done" | "error";
  result?: { clipName: string } | null;
  error?: string | null;
}

export default function StatusDisplay({
  status,
  result,
  error,
}: StatusDisplayProps) {
  if (status === "idle") return null;

  if (status === "generating") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-neutral-800 px-3 py-2 text-sm">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-600 border-t-violet-400" />
        <span className="text-neutral-300">Generating…</span>
      </div>
    );
  }

  if (status === "done" && result) {
    return (
      <div className="rounded-lg bg-emerald-900/30 px-3 py-2 text-sm text-emerald-300">
        Added to timeline: {result.clipName}
      </div>
    );
  }

  if (status === "error" && error) {
    return (
      <div className="rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-300">
        {error}
      </div>
    );
  }

  return null;
}
