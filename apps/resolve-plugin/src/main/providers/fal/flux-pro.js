/** @import { Provider, ProviderResult } from '../types.js' */
import { ProviderKind } from "../types.js";
import { runQueue } from "./queue-runner.js";

/** @type {Provider} */
export const fluxProProvider = {
  id: "fal-flux-pro",
  name: "Flux Pro",
  kind: ProviderKind.IMAGE,

  async generate({ apiKey, prompt, imageSize, numImages, ...rest }) {
    const result = await runQueue({
      apiKey,
      modelId: "fal-ai/flux-pro/v1.1",
      input: {
        prompt,
        ...(imageSize ? { image_size: imageSize } : {}),
        ...(numImages ? { num_images: numImages } : {}),
        ...rest,
      },
    });
    const url = result.images?.[0]?.url;
    if (!url) throw new Error("Flux Pro returned no images");
    return { type: "url", url, suffix: ".png" };
  },
};
