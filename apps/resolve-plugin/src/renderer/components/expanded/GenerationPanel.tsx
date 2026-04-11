import { useCallback } from "react";
import { useGenerationStore } from "../../stores/generation-store";
import { useKeysStore } from "../../stores/keys-store";
import { PROVIDER_MAP } from "../../constants/providers";
import ProviderSelect from "./ProviderSelect";
import ApiKeyInput from "./ApiKeyInput";
import PromptInput from "./PromptInput";
import GenerateButton from "./GenerateButton";
import StatusDisplay from "./StatusDisplay";

declare global {
  interface Window {
    api?: {
      generation: {
        run: (input: {
          providerId: string;
          prompt: string;
          apiKey: string;
          referenceImage?: string | null;
        }) => Promise<{ clipName: string; filePath?: string }>;
      };
      snapshot: {
        capture: () => Promise<{ filePath: string }>;
      };
    };
  }
}

export default function GenerationPanel() {
  const {
    activeTab,
    prompt,
    provider,
    status,
    result,
    error,
    referenceImage,
    setPrompt,
    setProvider,
    setGenerating,
    setResult,
    setError,
    setReferenceImage,
    clearReferenceImage,
  } = useGenerationStore();

  const { getKey, setKey } = useKeysStore();

  const providers = PROVIDER_MAP[activeTab] || [];
  const selectedProvider = providers.find((p) => p.id === provider);
  const keyId = selectedProvider?.keyId || "";
  const apiKeyValue = getKey(keyId);

  const canGenerate =
    !!provider && !!prompt.trim() && !!apiKeyValue && status !== "generating";

  const handleGenerate = useCallback(async () => {
    if (!provider || !prompt.trim() || !apiKeyValue) return;
    setGenerating();
    try {
      const res = await window.api?.generation.run({
        providerId: provider,
        prompt: prompt.trim(),
        apiKey: apiKeyValue,
        referenceImage,
      });
      if (res) {
        setResult(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    }
  }, [
    provider,
    prompt,
    apiKeyValue,
    referenceImage,
    setGenerating,
    setResult,
    setError,
  ]);

  const handleSnapshot = useCallback(async () => {
    try {
      const res = await window.api?.snapshot.capture();
      if (res?.filePath) {
        setReferenceImage(res.filePath);
      }
    } catch {
      // Snapshot failed silently
    }
  }, [setReferenceImage]);

  return (
    <div className="flex flex-col gap-3">
      <ProviderSelect
        providers={providers}
        value={provider}
        onChange={setProvider}
      />

      {selectedProvider && (
        <ApiKeyInput
          label={`${keyId} API Key`}
          value={apiKeyValue}
          onChange={(val) => setKey(keyId, val)}
        />
      )}

      <PromptInput
        value={prompt}
        onChange={setPrompt}
        disabled={status === "generating"}
      />

      {activeTab === "image" && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSnapshot}
            disabled={status === "generating"}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
          >
            Snapshot Frame
          </button>
          {referenceImage && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-emerald-400">Reference set</span>
              <button
                type="button"
                onClick={clearReferenceImage}
                className="text-xs text-neutral-500 hover:text-neutral-300"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      <GenerateButton
        onClick={handleGenerate}
        disabled={!canGenerate}
        generating={status === "generating"}
      />

      <StatusDisplay status={status} result={result} error={error} />
    </div>
  );
}
