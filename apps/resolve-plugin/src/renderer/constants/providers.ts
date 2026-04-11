export const PROVIDER_MAP: Record<
  string,
  { id: string; name: string; kind: string; keyId: string }[]
> = {
  image: [
    {
      id: "gemini-image",
      name: "Gemini Flash",
      kind: "image",
      keyId: "GOOGLE_API_KEY",
    },
    { id: "sjinn-image", name: "Sjinn", kind: "image", keyId: "SJINN_API_KEY" },
    {
      id: "fal-flux-schnell",
      name: "Flux Schnell",
      kind: "image",
      keyId: "FAL_KEY",
    },
    { id: "fal-flux-pro", name: "Flux Pro", kind: "image", keyId: "FAL_KEY" },
  ],
  video: [
    { id: "fal-kling-v2", name: "Kling v2", kind: "video", keyId: "FAL_KEY" },
    { id: "fal-veo3", name: "Veo 3", kind: "video", keyId: "FAL_KEY" },
    {
      id: "fal-luma",
      name: "Luma Dream Machine",
      kind: "video",
      keyId: "FAL_KEY",
    },
  ],
  audio: [
    {
      id: "fal-elevenlabs",
      name: "ElevenLabs",
      kind: "audio",
      keyId: "FAL_KEY",
    },
    {
      id: "fal-stable-audio",
      name: "Stable Audio",
      kind: "audio",
      keyId: "FAL_KEY",
    },
    {
      id: "fish-audio",
      name: "Fish Audio",
      kind: "audio",
      keyId: "FISH_AUDIO_KEY",
    },
  ],
};
