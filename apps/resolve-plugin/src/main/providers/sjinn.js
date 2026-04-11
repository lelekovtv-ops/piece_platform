import { ProviderKind } from "./types.js";
import { jsonPost } from "../utils/http.js";

const SJINN_BASE = "https://sjinn.ai/api/un-api";
const DEFAULT_POLL_INTERVAL_MS = 3_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;

export async function createSjinnTask({ apiKey, toolType, input }) {
  const data = await jsonPost(`${SJINN_BASE}/create_tool_task`, {
    body: { tool_type: toolType, input },
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!data.success || !data.data?.task_id) {
    throw new Error(data.errorMsg || "SJinn returned no task_id");
  }

  return { taskId: data.data.task_id };
}

export async function pollSjinnTask({ apiKey, taskId }) {
  const data = await jsonPost(`${SJINN_BASE}/query_tool_task_status`, {
    body: { task_id: taskId },
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!data.success || !data.data) {
    throw new Error(data.errorMsg || "Poll error");
  }

  return {
    taskId: data.data.task_id,
    status: data.data.status,
    outputUrls: data.data.output_urls || [],
    error: data.data.status === -1 ? data.errorMsg || "Task failed" : undefined,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inferSuffix(url, fallback = ".png") {
  try {
    const pathname = new URL(url).pathname;
    const dot = pathname.lastIndexOf(".");
    if (dot !== -1) return pathname.slice(dot);
  } catch {
    // ignore
  }
  return fallback;
}

function createSjinnProvider({ id, name, kind, toolType, defaultSuffix }) {
  return {
    id,
    name,
    kind,

    async generate({
      apiKey,
      prompt,
      image,
      referenceImage,
      aspectRatio,
      pollIntervalMs,
      maxPollAttempts,
      ...extra
    }) {
      const input = { prompt };
      const interval = pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
      const maxAttempts = maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;

      if (aspectRatio) {
        input.aspect_ratio = aspectRatio;
      }

      if (image || referenceImage) {
        input.image = image || referenceImage;
      }

      Object.assign(input, extra);

      const { taskId } = await createSjinnTask({
        apiKey,
        toolType,
        input,
      });

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await sleep(interval);

        const poll = await pollSjinnTask({ apiKey, taskId });

        if (poll.status === -1) {
          throw new Error(`SJinn task failed: ${poll.error}`);
        }

        if (poll.outputUrls.length > 0) {
          const url = poll.outputUrls[0];
          return {
            type: "url",
            url,
            suffix: inferSuffix(url, defaultSuffix),
          };
        }
      }

      throw new Error(
        `SJinn task ${taskId} timed out after ${maxAttempts} attempts`,
      );
    },
  };
}

// --- Image providers ---

export const sjinnNanoBananaProvider = createSjinnProvider({
  id: "sjinn-nano-banana",
  name: "Nano Banana",
  kind: ProviderKind.IMAGE,
  toolType: "nano-banana-image-api",
  defaultSuffix: ".png",
});

export const sjinnNanoBananaProProvider = createSjinnProvider({
  id: "sjinn-nano-banana-pro",
  name: "Nano Banana Pro",
  kind: ProviderKind.IMAGE,
  toolType: "nano-banana-image-pro-api",
  defaultSuffix: ".png",
});

export const sjinnNanoBanana2Provider = createSjinnProvider({
  id: "sjinn-nano-banana-2",
  name: "Nano Banana 2",
  kind: ProviderKind.IMAGE,
  toolType: "nano-banana-image-2-api",
  defaultSuffix: ".png",
});

export const sjinnSeedreamV4Provider = createSjinnProvider({
  id: "sjinn-seedream-v4",
  name: "Seedream v4.5",
  kind: ProviderKind.IMAGE,
  toolType: "seedream-v4-5-api",
  defaultSuffix: ".png",
});

export const sjinnSeedreamV5Provider = createSjinnProvider({
  id: "sjinn-seedream-v5",
  name: "Seedream v5 Lite",
  kind: ProviderKind.IMAGE,
  toolType: "seedream-v5-lite-api",
  defaultSuffix: ".png",
});

// --- Video providers ---

export const sjinnVeo3TextProvider = createSjinnProvider({
  id: "sjinn-veo3-text",
  name: "Veo 3 (text)",
  kind: ProviderKind.VIDEO,
  toolType: "veo3-text-to-video-fast-api",
  defaultSuffix: ".mp4",
});

export const sjinnVeo3ImageProvider = createSjinnProvider({
  id: "sjinn-veo3-image",
  name: "Veo 3 (image)",
  kind: ProviderKind.VIDEO,
  toolType: "veo3-image-to-video-fast-api",
  defaultSuffix: ".mp4",
});

export const sjinnSora2TextProvider = createSjinnProvider({
  id: "sjinn-sora2-text",
  name: "Sora 2 (text)",
  kind: ProviderKind.VIDEO,
  toolType: "sora2-text-to-video-api",
  defaultSuffix: ".mp4",
});

export const sjinnSora2ImageProvider = createSjinnProvider({
  id: "sjinn-sora2-image",
  name: "Sora 2 (image)",
  kind: ProviderKind.VIDEO,
  toolType: "sora2-image-to-video-api",
  defaultSuffix: ".mp4",
});

export const sjinnGrokTextProvider = createSjinnProvider({
  id: "sjinn-grok-text",
  name: "Grok (text)",
  kind: ProviderKind.VIDEO,
  toolType: "grok-text-to-video-api",
  defaultSuffix: ".mp4",
});

export const sjinnGrokImageProvider = createSjinnProvider({
  id: "sjinn-grok-image",
  name: "Grok (image)",
  kind: ProviderKind.VIDEO,
  toolType: "grok-image-to-video-api",
  defaultSuffix: ".mp4",
});

export const sjinnKling3TextProvider = createSjinnProvider({
  id: "sjinn-kling3-text",
  name: "Kling 3.0 (text)",
  kind: ProviderKind.VIDEO,
  toolType: "kling3-text-to-video-api",
  defaultSuffix: ".mp4",
});

export const sjinnKling3ImageProvider = createSjinnProvider({
  id: "sjinn-kling3-image",
  name: "Kling 3.0 (image)",
  kind: ProviderKind.VIDEO,
  toolType: "kling3-image-to-video-api",
  defaultSuffix: ".mp4",
});

// --- Lipsync provider ---

export const sjinnLipsyncProvider = createSjinnProvider({
  id: "sjinn-lipsync",
  name: "Photo Talk (lipsync)",
  kind: ProviderKind.VIDEO,
  toolType: "image-lipsync-api",
  defaultSuffix: ".mp4",
});

// Legacy export (kept for backwards compatibility with existing tests)
export const sjinnProvider = sjinnNanoBananaProvider;
