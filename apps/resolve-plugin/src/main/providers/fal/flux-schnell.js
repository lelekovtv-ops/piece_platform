/** @import { Provider, ProviderResult } from '../types.js' */
import { ProviderKind } from "../types.js";
import { runQueue } from "./queue-runner.js";

/** @type {Provider} */
export const fluxSchnellProvider = {
  id: "fal-flux-schnell",
  name: "Flux Schnell",
  kind: ProviderKind.IMAGE,

  async generate({ apiKey, prompt, imageSize, numImages, ...rest }) {
    const result = await runQueue({
      apiKey,
      modelId: "fal-ai/flux/schnell",
      input: {
        prompt,
        ...(imageSize ? { image_size: imageSize } : {}),
        ...(numImages ? { num_images: numImages } : {}),
        ...rest,
      },
    });
    const url = result.images?.[0]?.url;
    if (!url) throw new Error("Flux Schnell returned no images");
    return { type: "url", url, suffix: ".png" };
  },
};
