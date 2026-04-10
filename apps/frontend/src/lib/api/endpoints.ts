export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4030"

export const ENDPOINTS = {
  // Existing piece backend endpoints
  chat: "/v1/chat",
  translate: "/v1/translate",
  uploadPresign: "/v1/upload/presign",
  uploadComplete: "/v1/upload/complete",
  uploadTemp: "/v1/upload/temp",
  splitVision: "/v1/ai/split-vision",
  promptEnhance: "/v1/ai/prompt-enhance",
  capabilities: "/v1/system/capabilities",
  searchImages: (pid: string) => `/v1/projects/${pid}/generate/search`,
  generateImage: (pid: string) => `/v1/projects/${pid}/generate/image`,

  // ai-tools endpoints (created in this phase)
  nanoBanana: "/v1/tools/nano-banana",
  ambientImage: "/v1/tools/ambient-image",
  ambientPrompt: "/v1/tools/ambient-prompt",
  classifyIntent: "/v1/tools/classify-intent",
  sjinnCreate: "/v1/tools/sjinn",
  sjinnPoll: (taskId: string) => `/v1/tools/sjinn/${taskId}`,
  photoTo3dCreate: "/v1/tools/photo-to-3d",
  photoTo3dPoll: (taskId: string) => `/v1/tools/photo-to-3d/${taskId}`,
  smartDistribute: "/v1/tools/smart-distribute",

  // Library endpoints
  library: "/v1/library",
  libraryFile: (id: string) => `/v1/library/${id}`,
} as const
