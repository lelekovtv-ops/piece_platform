/** @import { Provider, ProviderResult } from './types.js' */

import { ProviderKind } from "./types.js";
import { jsonPost } from "../utils/http.js";

const SJINN_BASE = "https://sjinn.ai/api/un-api";
const DEFAULT_POLL_INTERVAL_MS = 3_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;

/**
 * Create a generation task on SJinn.
 * @param {{ apiKey: string, toolType: string, input: Record<string, unknown> }} opts
 * @returns {Promise<{ taskId: string }>}
 */
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

/**
 * Poll a SJinn task for completion.
 * @param {{ apiKey: string, taskId: string }} opts
 * @returns {Promise<{ taskId: string, status: number, outputUrls: string[], error?: string }>}
 */
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

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Infer file suffix from a URL.
 * @param {string} url
 * @returns {string}
 */
function inferSuffix(url) {
  try {
    const pathname = new URL(url).pathname;
    const dot = pathname.lastIndexOf(".");
    if (dot !== -1) return pathname.slice(dot);
  } catch {
    // ignore
  }
  return ".png";
}

/**
 * @type {Provider}
 */
export const sjinnProvider = {
  id: "sjinn",
  name: "SJinn",
  kind: ProviderKind.IMAGE,

  /**
   * @param {{ apiKey: string, toolType: string, input: Record<string, unknown>, pollIntervalMs?: number, maxPollAttempts?: number }} opts
   * @returns {Promise<ProviderResult>}
   */
  async generate({
    apiKey,
    toolType,
    input,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxPollAttempts = DEFAULT_MAX_POLL_ATTEMPTS,
  }) {
    const { taskId } = await createSjinnTask({ apiKey, toolType, input });

    for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
      await sleep(pollIntervalMs);

      const poll = await pollSjinnTask({ apiKey, taskId });

      if (poll.status === -1) {
        throw new Error(`SJinn task failed: ${poll.error}`);
      }

      if (poll.status === 3 && poll.outputUrls.length > 0) {
        const url = poll.outputUrls[0];
        return {
          type: "url",
          url,
          suffix: inferSuffix(url),
        };
      }
    }

    throw new Error(
      `SJinn task ${taskId} timed out after max poll attempts (${maxPollAttempts})`,
    );
  },
};
