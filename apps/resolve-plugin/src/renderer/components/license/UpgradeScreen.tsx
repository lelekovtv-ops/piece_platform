import { useCallback, useState } from "react";
import { useLicenseStore } from "../../stores/license-store";

declare global {
  interface Window {
    api?: {
      license: {
        check: () => Promise<{
          hasLicense: boolean;
          tier: string | null;
          expiresAt: string | null;
          stale: boolean;
          error?: string;
        }>;
        refresh: () => Promise<{
          hasLicense: boolean;
          tier: string | null;
          expiresAt: string | null;
          stale: boolean;
          error?: string;
        }>;
      };
    };
  }
}

const FEATURES = [
  "AI image generation (Gemini, Flux, Sjinn)",
  "AI video generation (Kling, Veo3, Luma)",
  "AI audio generation (Fish Audio, ElevenLabs, Stable Audio)",
  "Direct import to DaVinci Resolve timeline",
  "Bring Your Own API Keys — no subscription",
  "Frame snapshot for image-to-image reference",
];

export default function UpgradeScreen() {
  const { setLicense, setLoading } = useLicenseStore();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoading();
    try {
      const result = await window.api?.license.refresh();
      if (result) {
        setLicense(result);
      }
    } catch {
      // Silently fail — store already shows no license
    } finally {
      setRefreshing(false);
    }
  }, [setLicense, setLoading]);

  const handleGetLicense = useCallback(() => {
    window.open("https://piece.app/pricing", "_blank");
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-sm px-6 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600">
          <svg
            className="h-8 w-8 text-white"
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
        </div>

        <h1 className="text-xl font-semibold">PIECE Studio Pro</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Unlock AI generation inside DaVinci Resolve
        </p>

        <ul className="mt-6 space-y-2 text-left">
          {FEATURES.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2 text-sm text-neutral-300"
            >
              <span className="mt-0.5 text-emerald-400">✓</span>
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={handleGetLicense}
            className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:from-violet-500 hover:to-indigo-500"
          >
            Get License
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full rounded-lg border border-neutral-700 px-6 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
          >
            {refreshing ? "Checking…" : "Refresh License"}
          </button>
        </div>

        <p className="mt-6 text-xs text-neutral-600">
          Already purchased? Click Refresh License to activate.
        </p>
      </div>
    </div>
  );
}
