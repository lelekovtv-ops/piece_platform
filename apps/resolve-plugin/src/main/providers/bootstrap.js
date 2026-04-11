import { registerProvider } from "./registry.js";
import { sjinnProvider } from "./sjinn.js";
import { geminiProvider } from "./gemini.js";
import { fluxSchnellProvider } from "./fal/flux-schnell.js";
import { fluxProProvider } from "./fal/flux-pro.js";
import { klingV2Provider } from "./fal/kling-v2.js";
import { veo3Provider } from "./fal/veo3.js";
import { lumaProvider } from "./fal/luma.js";
import { elevenlabsProvider } from "./fal/elevenlabs.js";
import { stableAudioProvider } from "./fal/stable-audio.js";
import { fishAudioProvider } from "./fish-audio/tts.js";

const ALL_PROVIDERS = [
  sjinnProvider,
  geminiProvider,
  fluxSchnellProvider,
  fluxProProvider,
  klingV2Provider,
  veo3Provider,
  lumaProvider,
  elevenlabsProvider,
  stableAudioProvider,
  fishAudioProvider,
];

for (const provider of ALL_PROVIDERS) {
  registerProvider(provider);
}
