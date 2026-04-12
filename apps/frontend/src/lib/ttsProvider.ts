/**
 * TTS Provider — abstraction over multiple text-to-speech backends.
 *
 * Providers:
 * - "web-speech"  — browser-native SpeechSynthesis (free, instant, decent quality)
 * - "elevenlabs"  — ElevenLabs API (high quality, paid, async)
 * - "fish-audio"  — Fish Audio S2-Pro (80+ languages, emotion brackets)
 *
 * Each provider implements the same interface, returning an audio Blob.
 * The caller can then create a URL and attach it to a VoiceClip.
 */

import type {
  ProviderSettings,
  FishAudioSettings,
  ElevenLabsSettings,
  WebSpeechSettings,
} from "@/lib/bibleParser";

// ─── Types ───────────────────────────────────────────────────

export type TtsProviderType = "web-speech" | "elevenlabs" | "fish-audio";

export interface TtsRequest {
  text: string;
  lang: string;
  voiceId?: string;
  providerSettings?: ProviderSettings;
  // Legacy flat fields (used when providerSettings is not provided)
  speed?: number;
  pitch?: number;
  stability?: number;
  emotion?: string;
}

export interface TtsResult {
  audioBlob: Blob;
  durationMs: number;
  provider: TtsProviderType;
}

export interface TtsProvider {
  type: TtsProviderType;
  generate(request: TtsRequest): Promise<TtsResult>;
  getVoices(): Promise<{ id: string; name: string; lang: string }[]>;
}

// ─── Web Speech Provider ─────────────────────────────────────

function createWebSpeechProvider(): TtsProvider {
  return {
    type: "web-speech",

    async generate(request: TtsRequest): Promise<TtsResult> {
      return new Promise((resolve, reject) => {
        if (typeof window === "undefined" || !window.speechSynthesis) {
          reject(new Error("Web Speech API not available"));
          return;
        }

        const utterance = new SpeechSynthesisUtterance(request.text);
        utterance.lang = request.lang || "ru-RU";
        const ws = request.providerSettings as WebSpeechSettings | undefined;
        utterance.rate = ws?.speed ?? request.speed ?? 1.0;
        utterance.pitch = ws?.pitch ?? request.pitch ?? 1.0;

        if (request.voiceId) {
          const voice = window.speechSynthesis
            .getVoices()
            .find((v) => v.voiceURI === request.voiceId);
          if (voice) utterance.voice = voice;
        }

        // Try to capture audio via AudioContext + MediaRecorder
        const tryRecordSpeech = async () => {
          try {
            const audioCtx = new AudioContext();
            const dest = audioCtx.createMediaStreamDestination();
            const mediaRecorder = new MediaRecorder(dest.stream, {
              mimeType: "audio/webm;codecs=opus",
            });
            const chunks: Blob[] = [];

            mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunks.push(e.data);
            };

            const startTime = performance.now();
            mediaRecorder.start();
            window.speechSynthesis.speak(utterance);

            utterance.onend = () => {
              mediaRecorder.stop();
              const durationMs = Math.round(performance.now() - startTime);
              mediaRecorder.onstop = async () => {
                await audioCtx.close();
                const audioBlob = new Blob(chunks, { type: "audio/webm" });
                resolve({ audioBlob, durationMs, provider: "web-speech" });
              };
            };

            utterance.onerror = (e) => {
              mediaRecorder.stop();
              audioCtx.close().catch(() => {});
              if (e.error === "canceled" || e.error === "interrupted") {
                resolve({
                  audioBlob: new Blob([]),
                  durationMs: 0,
                  provider: "web-speech",
                });
                return;
              }
              reject(new Error(`Web Speech error: ${e.error}`));
            };
          } catch {
            // MediaRecorder not available — fallback to duration-only
            const startTime = performance.now();
            utterance.onend = () => {
              const durationMs = Math.round(performance.now() - startTime);
              resolve({
                audioBlob: new Blob([], { type: "audio/wav" }),
                durationMs,
                provider: "web-speech",
              });
            };
            utterance.onerror = (e) => {
              if (e.error === "canceled" || e.error === "interrupted") {
                resolve({
                  audioBlob: new Blob([]),
                  durationMs: 0,
                  provider: "web-speech",
                });
                return;
              }
              reject(new Error(`Web Speech error: ${e.error}`));
            };
            window.speechSynthesis.speak(utterance);
          }
        };

        tryRecordSpeech();
      });
    },

    async getVoices() {
      if (typeof window === "undefined" || !window.speechSynthesis) return [];
      const voices = window.speechSynthesis.getVoices();
      return voices.map((v) => ({
        id: v.voiceURI,
        name: v.name,
        lang: v.lang,
      }));
    },
  };
}

// ─── ElevenLabs Provider ─────────────────────────────────────

function createElevenLabsProvider(): TtsProvider {
  return {
    type: "elevenlabs",

    async generate(request: TtsRequest): Promise<TtsResult> {
      const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
      if (!apiKey)
        throw new Error(
          "ElevenLabs API key not set (NEXT_PUBLIC_ELEVENLABS_API_KEY)",
        );

      const s = request.providerSettings as ElevenLabsSettings | undefined;
      const voiceId = request.voiceId || "21m00Tcm4TlvDq8ikWAM"; // default: Rachel

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: request.text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: s?.stability ?? request.stability ?? 0.5,
              similarity_boost: s?.similarityBoost ?? 0.75,
              style: s?.style ?? 0.5,
              use_speaker_boost: s?.useSpeakerBoost ?? true,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `ElevenLabs API error: ${response.status} ${response.statusText}`,
        );
      }

      const audioBlob = await response.blob();

      // Estimate duration from blob size (MP3 ~128kbps)
      const estimatedDurationMs = Math.round((audioBlob.size * 8) / 128);

      return {
        audioBlob,
        durationMs: estimatedDurationMs,
        provider: "elevenlabs",
      };
    },

    async getVoices() {
      const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
      if (!apiKey) return [];

      try {
        const response = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: { "xi-api-key": apiKey },
        });
        if (!response.ok) return [];

        const data = await response.json();
        return (data.voices ?? []).map(
          (v: {
            voice_id: string;
            name: string;
            labels?: { language?: string };
          }) => ({
            id: v.voice_id,
            name: v.name,
            lang: v.labels?.language ?? "en",
          }),
        );
      } catch {
        return [];
      }
    },
  };
}

// ─── Fish Audio Provider ────────────────────────────────────

/** Extended voice info returned by Fish Audio catalog. */
export interface FishAudioVoice {
  id: string;
  name: string;
  lang: string;
  languages: string[];
  tags: string[];
  likeCount: number;
  samples: { text: string; url: string }[];
}

function createFishAudioProvider(): TtsProvider {
  return {
    type: "fish-audio",

    async generate(request: TtsRequest): Promise<TtsResult> {
      const apiKey = process.env.NEXT_PUBLIC_FISH_AUDIO_KEY;
      if (!apiKey)
        throw new Error(
          "Fish Audio API key not set (NEXT_PUBLIC_FISH_AUDIO_KEY)",
        );

      const s = request.providerSettings as FishAudioSettings | undefined;
      const referenceId = request.voiceId || undefined;

      // Inject [emotion] bracket tag into text if set
      let text = request.text;
      const emotion = s?.emotion || request.emotion;
      if (emotion) {
        text = `[${emotion}] ${text}`;
      }

      const body: Record<string, unknown> = {
        text,
        format: s?.format ?? "mp3",
        temperature: s?.temperature ?? 0.7,
        top_p: s?.topP ?? 0.7,
        latency: s?.latency ?? "normal",
        prosody: {
          speed: s?.speed ?? request.speed ?? 1.0,
          volume: s?.volume ?? 0,
          normalize_loudness: true,
        },
      };
      if (referenceId) body.reference_id = referenceId;

      const response = await fetch("https://api.fish.audio/v1/tts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          model: "s2-pro",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(
          `Fish Audio API error: ${response.status} ${response.statusText} ${errText}`,
        );
      }

      const audioBlob = await response.blob();
      const format = s?.format ?? "mp3";
      const bitrate = format === "opus" ? 64 : format === "wav" ? 1411 : 128;
      const estimatedDurationMs = Math.round((audioBlob.size * 8) / bitrate);

      return {
        audioBlob,
        durationMs: estimatedDurationMs,
        provider: "fish-audio",
      };
    },

    async getVoices() {
      const apiKey = process.env.NEXT_PUBLIC_FISH_AUDIO_KEY;
      if (!apiKey) return [];

      try {
        const response = await fetch(
          "https://api.fish.audio/model?page_size=20&sort_by=score",
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
        );
        if (!response.ok) return [];

        const data = await response.json();
        return (data.items ?? data ?? []).map(
          (v: {
            _id?: string;
            id?: string;
            title?: string;
            name?: string;
            languages?: string[];
          }) => ({
            id: v._id ?? v.id ?? "",
            name: v.title ?? v.name ?? "Unknown",
            lang: v.languages?.[0] ?? "en",
          }),
        );
      } catch {
        return [];
      }
    },
  };
}

/** Search Fish Audio voice catalog with filters. */
export async function searchFishAudioVoices(opts: {
  query?: string;
  language?: string;
  tag?: string;
  sortBy?: "score" | "task_count" | "created_at";
  pageSize?: number;
  pageNumber?: number;
  self?: boolean;
}): Promise<{ voices: FishAudioVoice[]; total: number }> {
  const apiKey = process.env.NEXT_PUBLIC_FISH_AUDIO_KEY;
  if (!apiKey) return { voices: [], total: 0 };

  const params = new URLSearchParams();
  params.set("page_size", String(opts.pageSize ?? 20));
  params.set("page_number", String(opts.pageNumber ?? 1));
  params.set("sort_by", opts.sortBy ?? "score");
  if (opts.query) params.set("title", opts.query);
  if (opts.language) params.append("language", opts.language);
  if (opts.tag) params.set("tag", opts.tag);
  if (opts.self) params.set("self", "true");

  try {
    const response = await fetch(
      `https://api.fish.audio/model?${params.toString()}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!response.ok) return { voices: [], total: 0 };

    const data = await response.json();
    const items = data.items ?? data ?? [];
    const voices: FishAudioVoice[] = items.map(
      (v: Record<string, unknown>) => ({
        id: (v._id as string) ?? (v.id as string) ?? "",
        name: (v.title as string) ?? (v.name as string) ?? "Unknown",
        lang: ((v.languages as string[]) ?? [])[0] ?? "en",
        languages: (v.languages as string[]) ?? [],
        tags: (v.tags as string[]) ?? [],
        likeCount: (v.like_count as number) ?? 0,
        samples: (
          (v.samples as { text?: string; url?: string; audio?: string }[]) ?? []
        ).map((s) => ({
          text: s.text ?? "",
          url: s.audio ?? s.url ?? "",
        })),
      }),
    );
    return { voices, total: data.total ?? voices.length };
  } catch {
    return { voices: [], total: 0 };
  }
}

// ─── Factory ─────────────────────────────────────────────────

const providers = new Map<TtsProviderType, TtsProvider>();

export function getTtsProvider(type: TtsProviderType): TtsProvider {
  if (!providers.has(type)) {
    switch (type) {
      case "web-speech":
        providers.set(type, createWebSpeechProvider());
        break;
      case "elevenlabs":
        providers.set(type, createElevenLabsProvider());
        break;
      case "fish-audio":
        providers.set(type, createFishAudioProvider());
        break;
    }
  }
  return providers.get(type)!;
}

/** Auto-detect best available provider. */
export function detectBestProvider(): TtsProviderType {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_FISH_AUDIO_KEY)
    return "fish-audio";
  if (
    typeof process !== "undefined" &&
    process.env?.NEXT_PUBLIC_ELEVENLABS_API_KEY
  )
    return "elevenlabs";
  return "web-speech";
}

/** Shortcut: generate speech with auto-detected or specified provider. */
export async function generateSpeech(
  request: TtsRequest,
  preferredProvider?: TtsProviderType,
): Promise<TtsResult> {
  const providerType = preferredProvider ?? detectBestProvider();
  const provider = getTtsProvider(providerType);
  return provider.generate(request);
}
