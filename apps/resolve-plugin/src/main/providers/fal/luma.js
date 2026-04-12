/** @import { Provider, ProviderResult } from '../types.js' */
import { ProviderKind } from "../types.js";
import { runQueue } from "./queue-runner.js";

/** @type {Provider} */
export const lumaProvider = {
  id: "fal-luma",
  name: "Luma Dream Machine",
  kind: ProviderKind.VIDEO,

  async generate({ apiKey, prompt, imageUrl, aspectRatio, ...rest }) {
    const result = await runQueue({
      apiKey,
      modelId: "fal-ai/luma-dream-machine",
      input: {
        prompt,
        ...(imageUrl ? { image_url: imageUrl } : {}),
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        ...rest,
      },
    });
    const url = result.video?.url;
    if (!url) throw new Error("Luma returned no video");
    return { type: "url", url, suffix: ".mp4" };
  },
};
