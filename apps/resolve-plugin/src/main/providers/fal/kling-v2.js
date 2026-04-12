/** @import { Provider, ProviderResult } from '../types.js' */
import { ProviderKind } from "../types.js";
import { runQueue } from "./queue-runner.js";

/** @type {Provider} */
export const klingV2Provider = {
  id: "fal-kling-v2",
  name: "Kling v2",
  kind: ProviderKind.VIDEO,

  async generate({ apiKey, prompt, imageUrl, duration, aspectRatio, ...rest }) {
    const result = await runQueue({
      apiKey,
      modelId: "fal-ai/kling-video/v2/master",
      input: {
        prompt,
        ...(imageUrl ? { image_url: imageUrl } : {}),
        ...(duration ? { duration } : {}),
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        ...rest,
      },
    });
    const url = result.video?.url;
    if (!url) throw new Error("Kling v2 returned no video");
    return { type: "url", url, suffix: ".mp4" };
  },
};
