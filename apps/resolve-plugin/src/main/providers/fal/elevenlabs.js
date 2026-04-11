/** @import { Provider, ProviderResult } from '../types.js' */
import { ProviderKind } from "../types.js";
import { runQueue } from "./queue-runner.js";

/** @type {Provider} */
export const elevenlabsProvider = {
  id: "fal-elevenlabs",
  name: "ElevenLabs TTS",
  kind: ProviderKind.AUDIO,

  async generate({ apiKey, text, voiceId, modelId, ...rest }) {
    const result = await runQueue({
      apiKey,
      modelId: "fal-ai/elevenlabs",
      input: {
        text,
        ...(voiceId ? { voice_id: voiceId } : {}),
        ...(modelId ? { model_id: modelId } : {}),
        ...rest,
      },
    });
    const url = result.audio?.url;
    if (!url) throw new Error("ElevenLabs returned no audio");
    return { type: "url", url, suffix: ".mp3" };
  },
};
