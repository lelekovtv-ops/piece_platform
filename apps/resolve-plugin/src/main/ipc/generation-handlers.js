import { join } from "path";
import { writeFileSync, mkdirSync } from "fs";
import { GENERATION_CHANNELS } from "../../shared/ipc-channels.js";
import { importAndAppend } from "../resolve/media-pool.js";
import { addToLibraryManifest } from "./library-handlers.js";

export function registerGenerationHandlers(
  handlers,
  { registry, downloadDir, dataDir, logger },
) {
  const log = logger.createComponentLogger
    ? logger.createComponentLogger("Generation")
    : logger;

  let currentStatus = "idle";

  handlers[GENERATION_CHANNELS.run] = async (params) => {
    const { providerId, provider, apiKey, prompt, duration, referenceImages, ...extra } = params || {};
    const resolvedProviderId = providerId || provider;

    if (!apiKey) {
      throw new Error("apiKey is required");
    }
    if (!prompt) {
      throw new Error("prompt is required");
    }

    const providerObj = registry.getProvider(resolvedProviderId);
    if (!providerObj) {
      throw new Error(`Provider not found: ${resolvedProviderId}`);
    }

    currentStatus = "generating";
    log.info("Generation started", {
      provider: resolvedProviderId,
      kind: providerObj.kind,
      duration: duration || null,
      refCount: referenceImages?.length || 0,
    });

    try {
      const genParams = { apiKey, prompt, ...extra };
      if (duration) genParams.duration = duration;

      if (referenceImages && referenceImages.length > 0) {
        const resolvedUrls = [];
        for (const ref of referenceImages) {
          if (ref.startsWith("http://") || ref.startsWith("https://")) {
            resolvedUrls.push(ref);
          } else {
            const { uploadFileForUrl } = await import("../utils/upload.js");
            const url = await uploadFileForUrl(ref);
            resolvedUrls.push(url);
          }
        }

        if (resolvedUrls.length === 1) {
          genParams.image = resolvedUrls[0];
        }
        if (resolvedUrls.length > 0) {
          genParams.image_list = resolvedUrls;
        }
      }

      const result = await providerObj.generate(genParams);

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

      try {
        addToLibraryManifest(dataDir, filePath, { provider: resolvedProviderId });
      } catch {
        // Non-critical
      }

      let clipName = filename;
      try {
        const { imported } = importAndAppend(filePath, {});
        clipName = imported?.[0]?.GetClipName?.() || filename;
      } catch (importErr) {
        log.warn("Could not import to Resolve timeline", {
          error: importErr.message,
        });
      }

      currentStatus = "idle";
      log.info("Generation complete", { clipName, filePath });

      return { clipName, filePath };
    } catch (err) {
      currentStatus = "idle";
      log.error("Generation failed", { error: err.message });
      throw err;
    }
  };

  handlers[GENERATION_CHANNELS.cancel] = () => {
    currentStatus = "idle";
    log.info("Generation cancelled");
  };

  handlers[GENERATION_CHANNELS.getStatus] = () => currentStatus;
}
