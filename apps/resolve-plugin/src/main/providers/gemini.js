/** @import { Provider, ProviderResult } from './types.js' */

import { ProviderKind } from "./types.js";
import { jsonPost } from "../utils/http.js";

const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * @type {Provider}
 */
export const geminiProvider = {
  id: "gemini",
  name: "Google Gemini",
  kind: ProviderKind.IMAGE,

  /**
   * @param {{ apiKey: string, prompt: string, references?: Array<{ mimeType: string, base64: string }>, aspectRatio?: string }} opts
   * @returns {Promise<ProviderResult>}
   */
  async generate({ apiKey, prompt, references = [], aspectRatio }) {
    const parts = [];

    for (const ref of references) {
      parts.push({
        inlineData: { mimeType: ref.mimeType, data: ref.base64 },
      });
    }

    parts.push({ text: prompt });

    const body = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        ...(aspectRatio ? { aspectRatio } : {}),
      },
    };

    const data = await jsonPost(GEMINI_URL, {
      body,
      headers: {
        "x-goog-api-key": apiKey,
      },
    });

    const candidate = data?.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((p) =>
      p.inlineData?.mimeType?.startsWith("image/"),
    );

    if (!imagePart) {
      throw new Error("Gemini returned no image in response");
    }

    const { mimeType, data: b64 } = imagePart.inlineData;
    const suffix = mimeType === "image/jpeg" ? ".jpg" : ".png";

    return {
      type: "bytes",
      value: Buffer.from(b64, "base64"),
      suffix,
      mimeType,
    };
  },
};
