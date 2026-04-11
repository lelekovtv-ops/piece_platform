/** @import { Provider, ProviderResult } from '../types.js' */
import { ProviderKind } from "../types.js";
import { runQueue } from "./queue-runner.js";

/** @type {Provider} */
export const stableAudioProvider = {
  id: "fal-stable-audio",
  name: "Stable Audio",
  kind: ProviderKind.AUDIO,

  async generate({ apiKey, prompt, duration, ...rest }) {
    const result = await runQueue({
      apiKey,
      modelId: "fal-ai/stable-audio",
      input: {
        prompt,
        ...(duration ? { audio_duration: duration } : {}),
        ...rest,
      },
    });
    const url = result.audio_file?.url;
    if (!url) throw new Error("Stable Audio returned no audio");
    return { type: "url", url, suffix: ".wav" };
  },
};
