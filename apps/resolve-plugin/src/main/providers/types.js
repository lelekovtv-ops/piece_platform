/**
 * Provider shape (JSDoc — main process is JS, not TS)
 *
 * @typedef {'image' | 'video' | 'audio' | 'lipsync'} ProviderKind
 *
 * @typedef {Object} ProviderResult
 * @property {'url' | 'bytes'} type
 * @property {string} [url]         - when type === 'url'
 * @property {Buffer} [value]       - when type === 'bytes'
 * @property {string} suffix        - e.g. '.png', '.mp4', '.wav'
 * @property {string} [mimeType]    - e.g. 'image/png'
 *
 * @typedef {Object} Provider
 * @property {string} id            - unique identifier, e.g. 'sjinn-image'
 * @property {string} name          - human-readable name
 * @property {ProviderKind} kind    - category
 * @property {(input: object) => Promise<ProviderResult>} generate
 */

export const ProviderKind = Object.freeze({
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  LIPSYNC: "lipsync",
});
