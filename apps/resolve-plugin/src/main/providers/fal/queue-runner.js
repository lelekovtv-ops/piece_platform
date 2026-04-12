import { jsonPost, jsonGet } from "../../utils/http.js";

const FAL_QUEUE_BASE = "https://queue.fal.run";
const DEFAULT_POLL_INTERVAL_MS = 3_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Submit a request to the fal.ai queue.
 * @param {{ apiKey: string, modelId: string, input: Record<string, unknown> }} opts
 * @returns {Promise<string>} request_id
 */
export async function submitToQueue({ apiKey, modelId, input }) {
  const data = await jsonPost(`${FAL_QUEUE_BASE}/${modelId}`, {
    body: input,
    headers: { Authorization: `Key ${apiKey}` },
  });
  return data.request_id;
}

/**
 * Poll queue status.
 * @param {{ apiKey: string, modelId: string, requestId: string }} opts
 * @returns {Promise<string>} status string
 */
export async function pollQueueStatus({ apiKey, modelId, requestId }) {
  const data = await jsonGet(
    `${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}/status`,
    { headers: { Authorization: `Key ${apiKey}` } },
  );
  return data.status;
}

/**
 * Fetch completed queue result.
 * @param {{ apiKey: string, modelId: string, requestId: string }} opts
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchQueueResult({ apiKey, modelId, requestId }) {
  return jsonGet(`${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}`, {
    headers: { Authorization: `Key ${apiKey}` },
  });
}

/**
 * Submit → poll → fetch result.
 * @param {{ apiKey: string, modelId: string, input: Record<string, unknown>, pollIntervalMs?: number, maxPollAttempts?: number }} opts
 * @returns {Promise<Record<string, unknown>>}
 */
export async function runQueue({
  apiKey,
  modelId,
  input,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  maxPollAttempts = DEFAULT_MAX_POLL_ATTEMPTS,
}) {
  const requestId = await submitToQueue({ apiKey, modelId, input });

  for (let i = 0; i < maxPollAttempts; i++) {
    await sleep(pollIntervalMs);
    const status = await pollQueueStatus({ apiKey, modelId, requestId });

    if (status === "COMPLETED") {
      return fetchQueueResult({ apiKey, modelId, requestId });
    }
  }

  throw new Error(
    `fal.ai queue ${modelId}/${requestId} timed out after max poll attempts (${maxPollAttempts})`,
  );
}
