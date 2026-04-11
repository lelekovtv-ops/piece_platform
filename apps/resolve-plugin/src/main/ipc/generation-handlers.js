import { join } from "path";
import { writeFileSync, mkdirSync } from "fs";
import { GENERATION_CHANNELS } from "../../shared/ipc-channels.js";
import { importAndAppend } from "../resolve/media-pool.js";

export function registerGenerationHandlers(
  handlers,
  { registry, downloadDir, logger },
) {
  const log = logger.createComponentLogger
    ? logger.createComponentLogger("Generation")
    : logger;

  let currentStatus = "idle";

  handlers[GENERATION_CHANNELS.run] = async (params) => {
    const { provider: providerId, apiKey, prompt, ...extra } = params || {};

    if (!apiKey) {
      throw new Error("apiKey is required");
    }
    if (!prompt) {
      throw new Error("prompt is required");
    }

    const provider = registry.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    currentStatus = "generating";
    log.info("Generation started", {
      provider: providerId,
      kind: provider.kind,
    });

    try {
      const result = await provider.generate({ apiKey, prompt, ...extra });

      mkdirSync(downloadDir, { recursive: true });

      const filename = `piece-${providerId}-${Date.now()}${result.suffix}`;
      const filePath = join(downloadDir, filename);

      if (result.type === "bytes") {
        writeFileSync(filePath, result.value);
      } else if (result.type === "url") {
        const resp = await fetch(result.url);
        if (!resp.ok) {
          throw new Error(`Failed to download: ${resp.status}`);
        }
        const buf = Buffer.from(await resp.arrayBuffer());
        writeFileSync(filePath, buf);
      }

      const { imported } = importAndAppend(filePath, {});

      currentStatus = "idle";
      const clipName = imported?.[0]?.GetClipName?.() || filename;
      log.info("Generation complete", { clipName, filePath });

      return { clipName, filePath };
    } catch (err) {
      currentStatus = "idle";
      log.error("Generation failed", { error: err.message });
      return { error: err.message };
    }
  };

  handlers[GENERATION_CHANNELS.cancel] = () => {
    currentStatus = "idle";
    log.info("Generation cancelled");
  };

  handlers[GENERATION_CHANNELS.getStatus] = () => currentStatus;
}
