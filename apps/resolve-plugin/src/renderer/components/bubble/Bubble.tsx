import { useCallback } from "react";
import { useUiStore } from "../../stores/ui-store";

const stateColors: Record<string, string> = {
  idle: "bg-violet-600",
  generating: "bg-violet-600 animate-pulse",
  success: "bg-emerald-500",
  error: "bg-red-500",
};

export default function Bubble() {
  const bubbleState = useUiStore((s) => s.bubbleState);

  const handleClick = useCallback(() => {
    window.api?.window.expand();
  }, []);

  const colorClass = stateColors[bubbleState] || stateColors.idle;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all hover:scale-110 ${colorClass}`}
      title="PIECE Studio"
    >
      <svg
        className="h-7 w-7 text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
        />
      </svg>
    </button>
  );
}
