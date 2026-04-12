/** @import { Provider, ProviderResult } from '../types.js' */
import { ProviderKind } from "../types.js";
import { runQueue } from "./queue-runner.js";

/** @type {Provider} */
export const veo3Provider = {
  id: "fal-veo3",
  name: "Veo 3",
  kind: ProviderKind.VIDEO,

  async generate({ apiKey, prompt, imageUrl, duration, aspectRatio, ...rest }) {
    const result = await runQueue({
      apiKey,
      modelId: "fal-ai/veo3",
      input: {
        prompt,
        ...(imageUrl ? { image_url: imageUrl } : {}),
        ...(duration ? { duration } : {}),
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        ...rest,
      },
    });
    const url = result.video?.url;
    if (!url) throw new Error("Veo 3 returned no video");
    return { type: "url", url, suffix: ".mp4" };
  },
};
