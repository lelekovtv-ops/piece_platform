import { useCallback } from "react";
import { useGenerationStore } from "../../stores/generation-store";
import { useAuthStore } from "../../stores/auth-store";
import { useUiStore } from "../../stores/ui-store";
import Tabs from "./Tabs";
import GenerationPanel from "./GenerationPanel";
import LibraryBar from "../library/LibraryBar";
import { PROVIDER_MAP } from "../../constants/providers";

export default function ExpandedPanel() {
  const { activeTab, setActiveTab, provider } = useGenerationStore();
  const userName = useAuthStore((s) => s.user?.name || s.user?.email || "");

  const handleCollapse = useCallback(() => {
    window.api?.window.collapse();
  }, []);

  const handleSignOut = useCallback(async () => {
    await window.api?.auth.signOut();
    useAuthStore.getState().setUnauthenticated();
    useUiStore.getState().setMode("bubble");
  }, []);

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-linear-to-br from-violet-600 to-indigo-600">
            <svg
              className="h-3.5 w-3.5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold">PIECE Studio</span>
        </div>
        <button
          type="button"
          onClick={handleCollapse}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
          title="Collapse to bubble"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 12h-15"
            />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3">
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <GenerationPanel />
      </div>

      {/* Library Bar */}
      <LibraryBar
        selectionMode={!!provider}
        maxReferences={
          (provider &&
            Object.values(PROVIDER_MAP)
              .flat()
              .find((p) => p.id === provider)?.maxReferences) ||
          0
        }
      />

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-neutral-800 px-4 py-2">
        <span className="truncate text-xs text-neutral-600">{userName}</span>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
