import { authFetch } from "@/lib/auth/auth-fetch"
import { ENDPOINTS } from "./endpoints"

/**
 * Maps Piece's chat request format to piece backend format and handles
 * the SSE stream format difference.
 *
 * Piece frontend expects: raw text stream (ReadableStream of text chunks)
 * Piece backend returns: SSE format (data: {"text": "chunk"}\n\n)
 *
 * This adapter calls piece backend and returns a Response with a raw text
 * ReadableStream that the existing frontend code can consume unchanged.
 */
export async function chatViaBackend(
  chatRequest: {
    messages: Array<{ role: string; content: string }>
    modelId?: string
    system?: string
    temperature?: number
    workspace?: string
  },
  fetchOptions?: { signal?: AbortSignal },
): Promise<Response> {
  const { provider, model } = resolveModel(chatRequest.modelId)

  const res = await authFetch(ENDPOINTS.chat, {
    method: "POST",
    body: JSON.stringify({
      messages: chatRequest.messages,
      provider,
      model,
      systemPrompt: chatRequest.system,
      temperature: chatRequest.temperature,
      stream: true,
    }),
    signal: fetchOptions?.signal,
  })

  if (!res.ok) return res

  // Transform SSE stream to raw text stream
  const sseBody = res.body
  if (!sseBody) return res

  const transformedStream = new ReadableStream({
    async start(controller) {
      const reader = sseBody.getReader()
      const decoder = new TextDecoder()

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          const lines = text.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const payload = line.slice(6).trim()
              if (payload === "[DONE]") continue
              try {
                const parsed = JSON.parse(payload)
                if (parsed.text) {
                  controller.enqueue(new TextEncoder().encode(parsed.text))
                }
              } catch {
                // Skip malformed SSE lines
              }
            }
          }
        }
      } catch (err) {
        controller.error(err)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(transformedStream, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}

function resolveModel(modelId?: string): { provider: string; model: string } {
  if (!modelId || modelId.startsWith("gemini"))
    return { provider: "google", model: modelId || "gemini-2.5-flash" }
  if (modelId.startsWith("claude"))
    return { provider: "anthropic", model: modelId }
  if (modelId.startsWith("gpt"))
    return { provider: "openai", model: modelId }
  return { provider: "google", model: modelId }
}
