import { useCallback, useEffect, useState } from "react";
import { useGenerationStore } from "../../stores/generation-store";
import { useKeysStore } from "../../stores/keys-store";
import { useQueueStore } from "../../stores/queue-store";
import { useLibraryStore } from "../../stores/library-store";
import { PROVIDER_MAP } from "../../constants/providers";
import ProviderSelect from "./ProviderSelect";
import ApiKeyInput from "./ApiKeyInput";
import PromptInput from "./PromptInput";
import GenerateButton from "./GenerateButton";
import StatusDisplay from "./StatusDisplay";
import DurationInput from "./DurationInput";
import ReferenceSelector from "./ReferenceSelector";
import QueueList from "./QueueList";

export default function GenerationPanel() {
  const {
    activeTab,
    prompt,
    provider,
    status,
    result,
    error,
    setPrompt,
    setProvider,
    setGenerating,
    setResult,
    setError,
  } = useGenerationStore();

  const { getKey, setKey } = useKeysStore();
  const queueStore = useQueueStore();
  const { selectedRefs, clearRefs } = useLibraryStore();

  const providers = PROVIDER_MAP[activeTab] || [];
  const selectedProvider = providers.find((p) => p.id === provider);
  const keyId = selectedProvider?.keyId || "";
  const apiKeyValue = getKey(keyId);

  const hasDuration = !!selectedProvider?.durationRange;
  const hasReferences = !!selectedProvider?.maxReferences && selectedProvider.maxReferences > 0;

  const [duration, setDuration] = useState<number>(
    selectedProvider?.durationRange?.default || 5
  );

  useEffect(() => {
    if (selectedProvider?.durationRange) {
      setDuration(selectedProvider.durationRange.default);
    }
  }, [selectedProvider]);

  useEffect(() => {
    queueStore.initListener();
  }, [queueStore]);

  useEffect(() => {
    if (!keyId || apiKeyValue) return;
    window.api?.keys?.get(keyId).then((val: string | null) => {
      if (val) setKey(keyId, val);
    });
  }, [keyId, apiKeyValue, setKey]);

  const canGenerate =
    !!provider && !!prompt.trim() && !!apiKeyValue && status !== "generating";

  const hasQueueItems = queueStore.items.some(
    (i) => i.status === "pending" || i.status === "generating"
  );

  const getRefUrls = useCallback(async (): Promise<string[]> => {
    if (!hasReferences || selectedRefs.length === 0) return [];
    const urls: string[] = [];
    for (const refId of selectedRefs) {
      const url = await window.api?.library.getUrl(refId);
      if (url) urls.push(url);
    }
    return urls;
  }, [hasReferences, selectedRefs]);

  const handleGenerate = useCallback(async () => {
    if (!provider || !prompt.trim() || !apiKeyValue) return;

    if (hasQueueItems) {
      const referenceImages = await getRefUrls();
      await queueStore.add({
        providerId: provider,
        prompt: prompt.trim(),
        apiKey: apiKeyValue,
        duration: hasDuration ? duration : undefined,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      });
      return;
    }

    setGenerating();
    try {
      const referenceImages = await getRefUrls();
      const res = await window.api?.generation.run({
        providerId: provider,
        prompt: prompt.trim(),
        apiKey: apiKeyValue,
        duration: hasDuration ? duration : undefined,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      });
      if (res) {
        setResult(res);
        clearRefs();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    }
  }, [
    provider, prompt, apiKeyValue, hasDuration, duration, hasQueueItems,
    getRefUrls, queueStore, setGenerating, setResult, setError, clearRefs,
  ]);

  const handleAddToQueue = useCallback(async () => {
    if (!provider || !prompt.trim() || !apiKeyValue) return;
    const referenceImages = await getRefUrls();
    await queueStore.add({
      providerId: provider,
      prompt: prompt.trim(),
      apiKey: apiKeyValue,
      duration: hasDuration ? duration : undefined,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
    });
  }, [provider, prompt, apiKeyValue, hasDuration, duration, getRefUrls, queueStore]);

  const handleSnapshot = useCallback(async () => {
    try {
      const res = await window.api?.snapshot.capture();
      if (res?.filePath) {
        await useLibraryStore.getState().loadItems();
      }
    } catch {
      // Snapshot failed silently
    }
  }, []);

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

      {hasDuration && (
        <DurationInput
          min={selectedProvider!.durationRange!.min}
          max={selectedProvider!.durationRange!.max}
          value={duration}
          onChange={setDuration}
          disabled={status === "generating"}
        />
      )}

      {hasReferences && (
        <ReferenceSelector
          maxReferences={selectedProvider!.maxReferences!}
          disabled={status === "generating"}
          onSnapshot={handleSnapshot}
        />
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <GenerateButton
            onClick={handleGenerate}
            disabled={!canGenerate}
            generating={status === "generating"}
          />
        </div>
        {canGenerate && (
          <button
            type="button"
            onClick={handleAddToQueue}
            className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
          >
            + Queue
          </button>
        )}
      </div>

      <StatusDisplay status={status} result={result} error={error} />

      <QueueList />
    </div>
  );
}
