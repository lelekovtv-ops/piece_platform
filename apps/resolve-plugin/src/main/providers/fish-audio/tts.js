/** @import { Provider, ProviderResult } from '../types.js' */

import { ProviderKind } from "../types.js";
import { ProviderHttpError } from "../../utils/http.js";

const FISH_AUDIO_TTS_URL = "https://api.fish.audio/v1/tts";

const MIME_MAP = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  opus: "audio/opus",
};

const SUFFIX_MAP = {
  mp3: ".mp3",
  wav: ".wav",
  opus: ".opus",
};

/** @type {Provider} */
export const fishAudioProvider = {
  id: "fish-audio",
  name: "Fish Audio TTS",
  kind: ProviderKind.AUDIO,

  /**
   * @param {{ apiKey: string, text: string, referenceId?: string, format?: 'mp3'|'wav'|'opus', speed?: number, volume?: number, temperature?: number, topP?: number, emotion?: string, latency?: string }} opts
   * @returns {Promise<ProviderResult>}
   */
  async generate({
    apiKey,
    text,
    referenceId,
    format = "mp3",
    speed = 1.0,
    volume = 0,
    temperature = 0.7,
    topP = 0.7,
    emotion,
    latency = "normal",
  }) {
    const finalText = emotion ? `[${emotion}] ${text}` : text;

    const body = {
      text: finalText,
      format,
      temperature,
      top_p: topP,
      latency,
      ...(referenceId ? { reference_id: referenceId } : {}),
      prosody: {
        speed,
        volume,
        normalize_loudness: true,
      },
    };

    const res = await fetch(FISH_AUDIO_TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        model: "s2-pro",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new ProviderHttpError(res.status, res.statusText, errText);
    }

    const audioBuffer = await res.arrayBuffer();

    return {
      type: "bytes",
      value: audioBuffer,
      suffix: SUFFIX_MAP[format] || ".mp3",
      mimeType: MIME_MAP[format] || "audio/mpeg",
    };
  },
};
