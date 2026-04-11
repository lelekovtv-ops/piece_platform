export const PROVIDER_MAP: Record<
  string,
  { id: string; name: string; kind: string; keyId: string }[]
> = {
  image: [
    { id: "sjinn-nano-banana", name: "Nano Banana", kind: "image", keyId: "SJINN_API_KEY" },
    { id: "sjinn-nano-banana-pro", name: "Nano Banana Pro", kind: "image", keyId: "SJINN_API_KEY" },
    { id: "sjinn-nano-banana-2", name: "Nano Banana 2", kind: "image", keyId: "SJINN_API_KEY" },
    { id: "sjinn-seedream-v4", name: "Seedream v4.5", kind: "image", keyId: "SJINN_API_KEY" },
    { id: "sjinn-seedream-v5", name: "Seedream v5 Lite", kind: "image", keyId: "SJINN_API_KEY" },
    { id: "gemini-image", name: "Gemini Flash", kind: "image", keyId: "GOOGLE_API_KEY" },
    { id: "fal-flux-schnell", name: "Flux Schnell", kind: "image", keyId: "FAL_KEY" },
    { id: "fal-flux-pro", name: "Flux Pro", kind: "image", keyId: "FAL_KEY" },
  ],
  video: [
    { id: "sjinn-veo3-text", name: "Veo 3 (text)", kind: "video", keyId: "SJINN_API_KEY" },
    { id: "sjinn-veo3-image", name: "Veo 3 (image)", kind: "video", keyId: "SJINN_API_KEY" },
    { id: "sjinn-sora2-text", name: "Sora 2 (text)", kind: "video", keyId: "SJINN_API_KEY" },
    { id: "sjinn-sora2-image", name: "Sora 2 (image)", kind: "video", keyId: "SJINN_API_KEY" },
    { id: "sjinn-grok-text", name: "Grok (text)", kind: "video", keyId: "SJINN_API_KEY" },
    { id: "sjinn-grok-image", name: "Grok (image)", kind: "video", keyId: "SJINN_API_KEY" },
    { id: "sjinn-kling3-text", name: "Kling 3.0 (text)", kind: "video", keyId: "SJINN_API_KEY" },
    { id: "sjinn-kling3-image", name: "Kling 3.0 (image)", kind: "video", keyId: "SJINN_API_KEY" },
    { id: "sjinn-lipsync", name: "Photo Talk (lipsync)", kind: "video", keyId: "SJINN_API_KEY" },
    { id: "fal-kling-v2", name: "Kling v2 (FAL)", kind: "video", keyId: "FAL_KEY" },
    { id: "fal-veo3", name: "Veo 3 (FAL)", kind: "video", keyId: "FAL_KEY" },
    { id: "fal-luma", name: "Luma Dream Machine", kind: "video", keyId: "FAL_KEY" },
  ],
  audio: [
    { id: "fal-elevenlabs", name: "ElevenLabs", kind: "audio", keyId: "FAL_KEY" },
    { id: "fal-stable-audio", name: "Stable Audio", kind: "audio", keyId: "FAL_KEY" },
    { id: "fish-audio", name: "Fish Audio", kind: "audio", keyId: "FISH_AUDIO_KEY" },
  ],
};
