"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  ChevronDown,
  Download,
  Film,
  ImageIcon,
  Loader2,
  Mic,
  Move3d,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react"
import { deleteBlob } from "@/lib/fileStorage"
import { saveBlobAdaptive } from "@/lib/blobAdapter"
import { createLibraryFile, deleteLibraryFile } from "@/lib/api/library-adapter"
import { type LibraryFile, useLibraryStore } from "@/store/library"
import { useProjectsStore } from "@/store/projects"
import { useBoardStore } from "@/store/board"
import { useTimelineStore } from "@/store/timeline"
import { ShotStudio } from "@/components/editor/ShotStudio"
import {
  GENERATION_MODELS,
  getGenerationModelById,
  getGenerationModelsByCategory,
} from "@/lib/generation/registry"
import type { GenerationCategory } from "@/lib/generation/types"

// ── Helpers ──

function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function detectType(file: File): LibraryFile["type"] {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"
  if (file.type.startsWith("audio/")) return "audio"
  return "other"
}

async function createThumbnail(file: File): Promise<string | undefined> {
  try {
    const bitmap = await createImageBitmap(file, { resizeWidth: 320, resizeQuality: "medium" })
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext("2d")
    if (!ctx) return undefined
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    return canvas.toDataURL("image/jpeg", 0.7)
  } catch {
    return undefined
  }
}

// ── Category UI config ──

type GenMode = "image" | "video" | "lipsync" | "motion"

const MODE_CONFIG: Record<GenMode, { icon: typeof ImageIcon; label: string; color: string; activeColor: string }> = {
  image:   { icon: ImageIcon, label: "IMG",  color: "text-white/25", activeColor: "bg-[#D4A853]/20 text-[#D4A853]" },
  video:   { icon: Video,     label: "VID",  color: "text-white/25", activeColor: "bg-purple-500/20 text-purple-400" },
  lipsync: { icon: Mic,       label: "LIP",  color: "text-white/25", activeColor: "bg-emerald-500/20 text-emerald-400" },
  motion:  { icon: Move3d,    label: "MOT",  color: "text-white/25", activeColor: "bg-cyan-500/20 text-cyan-400" },
}

const MODE_ACCENT: Record<GenMode, string> = {
  image: "#D4A853",
  video: "#a855f7",
  lipsync: "#10b981",
  motion: "#06b6d4",
}

// ── Generation Queue ──

type QueueJob = {
  id: string
  prompt: string
  modelId: string
  modelLabel: string
  mode: GenMode
  status: "uploading" | "queued" | "processing" | "done" | "error"
  progress: number // 0-100
  error?: string
  startedAt: number
  thumbnailUrl?: string // preview when done
}

/** What inputs does this model need? */
function getModelInputs(modelId: string) {
  const m = getGenerationModelById(modelId)
  if (!m) return { needsPrompt: true, needsImage: false, needsAudio: false, needsMotionVideo: false, maxRefs: 3 }
  const caps = m.capabilities
  return {
    needsPrompt: caps.some((c) => c.includes("text")),
    needsImage: caps.some((c) => c.includes("image-to") || c === "lipsync" || c === "motion-control"),
    needsAudio: caps.includes("lipsync"),
    needsMotionVideo: caps.includes("motion-control"),
    maxRefs: m.provider === "openai" ? 4 : 3,
  }
}

type ViewMode = "all" | "generated" | "uploaded"
const LIBRARY_SHOT_PREFIX = "__lib_"

// Convert image URL (blob:/object) to data URL for generation API
async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    if (url.startsWith("data:")) return url
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// ── Main Page ──

export default function LibraryPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const refInputRef = useRef<HTMLInputElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const promptBarRef = useRef<HTMLDivElement>(null)
  const [dragCounter, setDragCounter] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>("all")
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Prompt bar
  const [prompt, setPrompt] = useState("")
  const [batchCount, setBatchCount] = useState(1)
  const [modelOpen, setModelOpen] = useState(false)
  const [genMode, setGenMode] = useState<GenMode>("image")
  // Ref images: stored as { url: display URL, dataUrl: base64 for API }
  const [refImages, setRefImages] = useState<Array<{ url: string; dataUrl: string }>>([])
  // Source image for i2v / lipsync / motion
  const [sourceImage, setSourceImage] = useState<{ url: string; dataUrl: string } | null>(null)
  // Audio for lipsync
  const [audioFile, setAudioFile] = useState<{ name: string; dataUrl: string } | null>(null)
  // Motion video for motion control
  const [motionVideo, setMotionVideo] = useState<{ name: string; dataUrl: string } | null>(null)
  const [refDropHover, setRefDropHover] = useState(false)
  // Parallel generation queue
  const [queue, setQueue] = useState<QueueJob[]>([])
  const activeJobs = useMemo(() => queue.filter((j) => j.status !== "done" && j.status !== "error"), [queue])

  // ShotStudio overlay
  const [studioShotId, setStudioShotId] = useState<string | null>(null)
  const [studioLibFileId, setStudioLibFileId] = useState<string | null>(null)
  // Video player overlay
  const [videoPreview, setVideoPreview] = useState<LibraryFile | null>(null)

  const projectId = useProjectsStore((s) => s.activeProjectId)
  const files = useLibraryStore((s) => s.files)
  const searchQuery = useLibraryStore((s) => s.searchQuery)
  const addFile = useLibraryStore((s) => s.addFile)
  const addFiles = useLibraryStore((s) => s.addFiles)
  const removeFile = useLibraryStore((s) => s.removeFile)
  const updateFile = useLibraryStore((s) => s.updateFile)
  const setSearchQuery = useLibraryStore((s) => s.setSearchQuery)

  const addShot = useTimelineStore((s) => s.addShot)
  const removeShot = useTimelineStore((s) => s.removeShot)

  const selectedModel = useBoardStore((s) => s.selectedImageGenModel)
  const setSelectedModel = useBoardStore((s) => s.setSelectedImageGenModel)
  const selectedVideoModel = useBoardStore((s) => s.selectedVideoModel) ?? "sjinn-veo3"
  const setSelectedVideoModel = useBoardStore((s) => s.setSelectedVideoModel)
  const projectStyle = useBoardStore((s) => s.projectStyle)

  // Track selected model per category
  const [selectedLipsyncModel, setSelectedLipsyncModel] = useState("sjinn-lipsync")
  const [selectedMotionModel, setSelectedMotionModel] = useState("sjinn-kling3-motion")

  const activeModelId = genMode === "image" ? selectedModel
    : genMode === "video" ? selectedVideoModel
    : genMode === "lipsync" ? selectedLipsyncModel
    : selectedMotionModel

  const setActiveModel = (id: string) => {
    if (genMode === "image") setSelectedModel(id)
    else if (genMode === "video") setSelectedVideoModel(id)
    else if (genMode === "lipsync") setSelectedLipsyncModel(id)
    else setSelectedMotionModel(id)
  }

  const modelInputs = getModelInputs(activeModelId)
  const modelsForMode = getGenerationModelsByCategory(genMode as GenerationCategory)
  const activeModelDef = getGenerationModelById(activeModelId)
  const accent = MODE_ACCENT[genMode]

  const isDragOver = dragCounter > 0
  const maxRefs = modelInputs.maxRefs

  // Trim refs if model changes to one with lower limit
  useEffect(() => {
    setRefImages((prev) => prev.slice(0, maxRefs))
  }, [maxRefs])

  // Track fullscreen
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  }, [])

  // ── Upload ──

  const processFiles = useCallback(
    async (incoming: File[]) => {
      if (incoming.length === 0) return
      const now = Date.now()
      const pid = projectId ?? "global"
      const prepared = await Promise.all(
        incoming.map(async (file) => {
          const id = uid()
          const objectUrl = URL.createObjectURL(file)
          const type = detectType(file)
          const thumbnailUrl = type === "image" ? await createThumbnail(file) : undefined

          // Try S3 upload, fallback to IndexedDB
          const result = await saveBlobAdaptive(id, file, pid)

          const entry: LibraryFile = {
            id, name: file.name, type, mimeType: file.type || "application/octet-stream",
            size: file.size, url: result.remote ? result.url : objectUrl,
            thumbnailUrl: result.thumbnailUrl || thumbnailUrl,
            createdAt: now, updatedAt: now,
            tags: [] as string[], projectId: pid, folder: "/", origin: "uploaded" as const,
            s3Key: result.s3Key, publicUrl: result.remote ? result.url : undefined,
          }

          // Save metadata to backend if uploaded to S3
          if (result.remote && result.s3Key) {
            try {
              const saved = await createLibraryFile({
                projectId: pid, name: file.name, type, mimeType: entry.mimeType,
                size: file.size, s3Key: result.s3Key, publicUrl: result.url,
                tags: [], origin: "uploaded",
              })
              entry.id = saved.id
              entry.thumbnailUrl = saved.thumbnailUrl || entry.thumbnailUrl
            } catch {
              // Backend save failed — file still accessible via S3 URL
            }
          }

          return entry
        })
      )
      addFiles(prepared)
    },
    [addFiles, projectId]
  )

  const handleDelete = async (file: LibraryFile) => {
    removeFile(file.id)
    if (file.url.startsWith("blob:")) URL.revokeObjectURL(file.url)
    try { await deleteBlob(file.id) } catch {}
    // Delete from S3 + backend if uploaded remotely
    if (file.s3Key) {
      try { await deleteLibraryFile(file.id) } catch {}
    }
  }

  // ── Add ref image (from file picker) ──

  const addRefFromFile = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith("image/")) continue
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setRefImages((prev) => {
            if (prev.length >= (getGenerationModelById(useBoardStore.getState().selectedImageGenModel)?.provider === "openai" ? 4 : 3)) return prev
            return [...prev, { url: reader.result as string, dataUrl: reader.result as string }]
          })
        }
      }
      reader.readAsDataURL(file)
    }
  }, [])

  // ── Add ref from library image (drag & drop or click) ──

  const addRefFromLibrary = useCallback(async (imageUrl: string) => {
    if (refImages.length >= maxRefs) return
    // Check for duplicates
    if (refImages.some((r) => r.url === imageUrl)) return
    const dataUrl = await urlToDataUrl(imageUrl)
    if (!dataUrl) return
    setRefImages((prev) => {
      if (prev.length >= maxRefs) return prev
      return [...prev, { url: imageUrl, dataUrl }]
    })
  }, [refImages, maxRefs])

  // ── Generate ──

  // Update a queue job by id
  const updateJob = useCallback((jobId: string, patch: Partial<QueueJob>) => {
    setQueue((prev) => prev.map((j) => j.id === jobId ? { ...j, ...patch } : j))
  }, [])

  // Remove completed/errored jobs after delay
  const dismissJob = useCallback((jobId: string) => {
    setQueue((prev) => prev.filter((j) => j.id !== jobId))
  }, [])

  // Auto-dismiss done jobs after 8 seconds
  useEffect(() => {
    const doneJobs = queue.filter((j) => j.status === "done" || j.status === "error")
    if (doneJobs.length === 0) return
    const timers = doneJobs.map((j) =>
      setTimeout(() => dismissJob(j.id), j.status === "error" ? 15000 : 8000)
    )
    return () => timers.forEach(clearTimeout)
  }, [queue, dismissJob])

  const handleGenerate = useCallback(() => {
    const userPrompt = prompt.trim()
    // Prompt required for text-to-* models
    if (modelInputs.needsPrompt && !userPrompt) return
    // Image required for i2v / lipsync / motion
    if (modelInputs.needsImage && !sourceImage && refImages.length === 0) return
    if (modelInputs.needsAudio && !audioFile) return

    const fullPrompt = projectStyle && userPrompt ? `Art style: ${projectStyle}.\n\n${userPrompt}` : userPrompt
    const pid = projectId ?? "global"
    const refDataUrls = refImages.map((r) => r.dataUrl)
    const isVideo = genMode === "video" || genMode === "lipsync" || genMode === "motion"
    const count = isVideo ? 1 : batchCount
    const modelLabel = activeModelDef?.label || activeModelId

    // Snapshot current inputs for the background job
    const snap = {
      modelId: activeModelId,
      fullPrompt,
      userPrompt,
      refDataUrls: refDataUrls.length > 0 ? [...refDataUrls] : undefined,
      sourceDataUrl: sourceImage?.dataUrl,
      audioDataUrl: audioFile?.dataUrl,
      motionDataUrl: motionVideo?.dataUrl,
    }

    // Spawn background jobs
    for (let i = 0; i < count; i++) {
      const jobId = uid()
      const job: QueueJob = {
        id: jobId,
        prompt: userPrompt,
        modelId: snap.modelId,
        modelLabel,
        mode: genMode,
        status: "uploading",
        progress: 0,
        startedAt: Date.now(),
      }

      setQueue((prev) => [...prev, job])

      // Fire and forget — runs in background
      void (async () => {
        try {
          const { generateContent } = await import("@/lib/generation/client")
          const result = await generateContent(
            {
              model: snap.modelId,
              prompt: snap.fullPrompt,
              referenceImages: snap.refDataUrls,
              sourceImageUrl: snap.sourceDataUrl,
              audioUrl: snap.audioDataUrl,
              motionVideoUrl: snap.motionDataUrl,
            },
            (p) => {
              const status = p.status === "queued" ? "queued" as const : "processing" as const
              const progress = p.status === "queued" ? 15 : p.status === "processing" ? 60 : 30
              updateJob(jobId, { status, progress })
            },
          )

          if (!result.blob) throw new Error("No result")

          const { blob, contentType } = result
          const id = uid()
          const objectUrl = URL.createObjectURL(blob)

          const fileType = contentType.startsWith("video") ? "video" : "image"
          const ext = fileType === "video" ? "mp4" : "png"
          const mime = fileType === "video" ? "video/mp4" : "image/png"

          // Try S3 upload for generated content
          const uploadResult = await saveBlobAdaptive(id, blob, pid)

          const entry: LibraryFile = {
            id, name: `gen_${Date.now()}.${ext}`, type: fileType, mimeType: mime,
            size: blob.size, url: uploadResult.remote ? uploadResult.url : objectUrl,
            thumbnailUrl: uploadResult.thumbnailUrl || (fileType === "image" ? objectUrl : undefined),
            createdAt: Date.now(), updatedAt: Date.now(), tags: [],
            projectId: pid, folder: "/", origin: "generated",
            prompt: snap.userPrompt, model: snap.modelId, fullPrompt: snap.fullPrompt,
            s3Key: uploadResult.s3Key, publicUrl: uploadResult.remote ? uploadResult.url : undefined,
          }

          if (uploadResult.remote && uploadResult.s3Key) {
            try {
              const saved = await createLibraryFile({
                projectId: pid, name: entry.name, type: fileType, mimeType: mime,
                size: blob.size, s3Key: uploadResult.s3Key, publicUrl: uploadResult.url,
                tags: [], origin: "generated", prompt: snap.userPrompt, model: snap.modelId,
              })
              entry.id = saved.id
              entry.thumbnailUrl = saved.thumbnailUrl || entry.thumbnailUrl
            } catch {
              // Backend save failed — file still accessible
            }
          }

          addFile(entry)

          updateJob(jobId, { status: "done", progress: 100, thumbnailUrl: fileType === "image" ? objectUrl : undefined })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error("[Library] Generation failed:", msg)
          updateJob(jobId, { status: "error", error: msg })
        }
      })()
    }
  }, [prompt, activeModelId, activeModelDef, batchCount, refImages, sourceImage, audioFile, motionVideo, projectStyle, projectId, addFile, modelInputs, genMode, updateJob])

  // ── Open ShotStudio ──

  const openStudio = useCallback((file: LibraryFile) => {
    const shotId = addShot({
      label: LIBRARY_SHOT_PREFIX + file.id,
      imagePrompt: file.prompt || "",
      thumbnailUrl: file.url || null,
      generationHistory: file.url
        ? [{ url: file.url, blobKey: null, timestamp: file.createdAt || Date.now(), source: "generate" as const }]
        : [],
      activeHistoryIndex: file.url ? 0 : null,
    })
    setStudioShotId(shotId)
    setStudioLibFileId(file.id)
  }, [addShot])

  const handleStudioClose = useCallback(() => {
    if (!studioShotId) return
    const shot = useTimelineStore.getState().shots.find((s) => s.id === studioShotId)
    const pid = projectId ?? "global"

    if (shot && shot.thumbnailUrl && studioLibFileId) {
      updateFile(studioLibFileId, {
        url: shot.thumbnailUrl,
        prompt: shot.imagePrompt || undefined,
        model: selectedModel,
      })
      const history = shot.generationHistory || []
      for (let i = 1; i < history.length; i++) {
        const entry = history[i]
        if (!entry.url || entry.source === "loading") continue
        addFile({
          id: uid(), name: `gen_${Date.now()}.png`, type: "image", mimeType: "image/png",
          size: 0, url: entry.url, thumbnailUrl: entry.url,
          createdAt: entry.timestamp, updatedAt: entry.timestamp, tags: [],
          projectId: pid, folder: "/", origin: "generated",
          prompt: shot.imagePrompt || undefined, model: selectedModel,
        })
      }
    }

    removeShot(studioShotId)
    setStudioShotId(null)
    setStudioLibFileId(null)
  }, [studioShotId, studioLibFileId, projectId, selectedModel, updateFile, addFile, removeShot])

  // ── Filter ──

  const filtered = useMemo(() => {
    let items = files.filter((f) => projectId ? f.projectId === projectId : true)
    if (viewMode === "generated") items = items.filter((f) => f.origin === "generated")
    else if (viewMode === "uploaded") items = items.filter((f) => f.origin === "uploaded")
    items = items.filter((f) => f.type === "image" || f.type === "video")
    const q = searchQuery.trim().toLowerCase()
    if (q) items = items.filter((f) => f.name.toLowerCase().includes(q) || f.prompt?.toLowerCase().includes(q))
    return items.sort((a, b) => b.createdAt - a.createdAt)
  }, [files, projectId, viewMode, searchQuery])

  const generatedCount = files.filter((f) => f.origin === "generated" && (f.type === "image" || f.type === "video")).length
  const uploadedCount = files.filter((f) => f.origin === "uploaded" && (f.type === "image" || f.type === "video")).length

  const downloadImage = (file: LibraryFile) => {
    const a = document.createElement("a")
    a.href = file.url
    a.download = file.name
    a.click()
  }

  const showPromptBar = !isFullscreen
  const isViewing = !!studioShotId
  const [barHovered, setBarHovered] = useState(false)

  // ── Prompt bar drop handler ──

  const handlePromptBarDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setRefDropHover(false)
    const libUrl = e.dataTransfer.getData("application/x-library-ref")
    if (libUrl) {
      void addRefFromLibrary(libUrl)
    }
  }, [addRefFromLibrary])

  // Ref slot count
  const emptySlots = maxRefs - refImages.length

  return (
    <div
      className="relative flex h-full flex-col bg-[#0A0A09] text-white"
      onDragEnter={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes("Files")) setDragCounter((v) => v + 1) }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy" }}
      onDragLeave={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes("Files")) setDragCounter((v) => Math.max(0, v - 1)) }}
      onDrop={(e) => { e.preventDefault(); setDragCounter(0); if (e.dataTransfer.files.length > 0) void processFiles(Array.from(e.dataTransfer.files)) }}
    >
      {/* ── Gallery ── */}
      <div className="relative flex-1 overflow-y-auto pb-32">
        {/* Mini top bar */}
        <div className="sticky top-0 z-30 flex items-center gap-2 bg-[#0A0A09]/80 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-0.5">
            {([
              ["all", "All", filtered.length],
              ["generated", "Generated", generatedCount],
              ["uploaded", "Uploaded", uploadedCount],
            ] as const).map(([mode, label, count]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as ViewMode)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                  viewMode === mode ? "bg-white/8 text-white/70" : "text-white/25 hover:text-white/45"
                }`}
              >
                {label} <span className="tabular-nums text-white/15">{count}</span>
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1.5 h-3 w-3 text-white/15" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-[160px] rounded-md border border-white/6 bg-white/3 py-1 pl-6 pr-2 text-[10px] text-white/60 outline-none placeholder:text-white/15 focus:border-white/12"
            />
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="rounded-md p-1.5 text-white/20 transition-colors hover:bg-white/5 hover:text-white/50"
            title="Upload"
          >
            <Upload size={12} />
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={(e) => { void processFiles(Array.from(e.target.files ?? [])); e.target.value = "" }}
          className="hidden"
        />

        {/* ── Generation Queue Strip ── */}
        {queue.length > 0 && (
          <div className="flex flex-col gap-1 px-2 py-1.5">
            {queue.map((job) => {
              const accent = MODE_ACCENT[job.mode]
              const isDone = job.status === "done"
              const isErr = job.status === "error"
              return (
                <div
                  key={job.id}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all ${
                    isDone ? "border-emerald-500/20 bg-emerald-500/5" :
                    isErr ? "border-red-500/20 bg-red-500/5" :
                    "border-white/6 bg-white/[0.02]"
                  }`}
                >
                  {/* Status icon */}
                  {isDone ? (
                    <Check size={12} className="flex-shrink-0 text-emerald-400" />
                  ) : isErr ? (
                    <X size={12} className="flex-shrink-0 text-red-400" />
                  ) : (
                    <Loader2 size={12} className="flex-shrink-0 animate-spin" style={{ color: accent }} />
                  )}

                  {/* Thumbnail (when done with image) */}
                  {job.thumbnailUrl && (
                    <img src={job.thumbnailUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded object-cover" />
                  )}

                  {/* Info */}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[10px] text-white/50">
                        {job.prompt || "Generation"}
                      </span>
                      <span className="flex-shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[8px] font-medium text-white/25">
                        {job.modelLabel}
                      </span>
                    </div>
                    {isErr && job.error && (
                      <span className="truncate text-[9px] text-red-400/70">{job.error}</span>
                    )}
                    {!isDone && !isErr && (
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ backgroundColor: `${accent}80`, width: `${job.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Status text */}
                  <span className={`flex-shrink-0 text-[9px] ${
                    isDone ? "text-emerald-400/60" : isErr ? "text-red-400/60" : "text-white/20"
                  }`}>
                    {isDone ? "Done" :
                     isErr ? "Failed" :
                     job.status === "uploading" ? "Uploading..." :
                     job.status === "queued" ? "In queue..." :
                     "Generating..."}
                  </span>

                  {/* Dismiss */}
                  {(isDone || isErr) && (
                    <button
                      onClick={() => dismissJob(job.id)}
                      className="flex-shrink-0 text-white/15 hover:text-white/40"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex h-[calc(100%-48px)] items-center justify-center">
            <div className="text-center">
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-white/6" />
              <p className="text-[13px] text-white/20">
                {viewMode === "generated" ? "No generations yet" : "Library is empty"}
              </p>
              <p className="mt-1 text-[11px] text-white/10">Type a prompt below to generate</p>
            </div>
          </div>
        ) : (
          <div className="columns-[240px] gap-1 px-1 pb-1">
            {filtered.map((file) => (
              <div
                key={file.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-library-ref", file.url)
                  e.dataTransfer.effectAllowed = "copy"
                  // Custom ghost
                  const ghost = document.createElement("div")
                  ghost.style.cssText = "width:60px;height:60px;border-radius:8px;overflow:hidden;position:absolute;top:-999px;"
                  const img = document.createElement("img")
                  img.src = file.thumbnailUrl || file.url
                  img.style.cssText = "width:100%;height:100%;object-fit:cover;"
                  ghost.appendChild(img)
                  document.body.appendChild(ghost)
                  e.dataTransfer.setDragImage(ghost, 30, 30)
                  requestAnimationFrame(() => document.body.removeChild(ghost))
                }}
                className="group relative mb-1 cursor-pointer break-inside-avoid overflow-hidden"
                onClick={() => file.type === "video" ? setVideoPreview(file) : openStudio(file)}
              >
                {file.url ? (
                  file.type === "video" ? (
                    <div className="relative aspect-video w-full bg-black">
                      <video src={file.url} className="block h-full w-full object-cover" muted loop playsInline
                        onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                        onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
                      />
                      <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                        <Film size={8} className="text-purple-400" />
                        <span className="text-[8px] font-medium text-purple-400">VIDEO</span>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={file.thumbnailUrl || file.url}
                      alt=""
                      className="block w-full transition-opacity duration-200 group-hover:opacity-80"
                      loading="lazy"
                    />
                  )
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-white/2">
                    <ImageIcon className="h-8 w-8 text-white/10" />
                  </div>
                )}
                {/* Hover actions */}
                <div className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadImage(file) }}
                      className="rounded bg-black/60 p-1.5 text-white/70 backdrop-blur-sm hover:bg-black/80 hover:text-white"
                    >
                      <Download size={11} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); void handleDelete(file) }}
                      className="rounded bg-black/60 p-1.5 text-white/70 backdrop-blur-sm hover:bg-red-900/80 hover:text-red-300"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Drag overlay — only for external file drops, no blur */}
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 z-40">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#D4A853]/40" />
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════
          ── Floating Prompt Bar ──
          ════════════════════════════════════════════ */}
      {showPromptBar && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[190] pointer-events-none"
          onMouseEnter={() => setBarHovered(true)}
          onMouseLeave={() => setBarHovered(false)}
        >
          <div
            ref={promptBarRef}
            className="pointer-events-auto mx-auto max-w-[760px] px-4 pb-4"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("application/x-library-ref")) {
                e.preventDefault()
                e.dataTransfer.dropEffect = "copy"
                setRefDropHover(true)
              }
            }}
            onDragLeave={() => setRefDropHover(false)}
            onDrop={handlePromptBarDrop}
          >
            {(() => {
              const collapsed = isViewing && !barHovered
              return (
                <div
                  className={`rounded-2xl border backdrop-blur-xl ${
                    refDropHover ? "border-[#D4A853]/40" : "border-white/8"
                  } ${collapsed
                    ? "bg-[#141310]/60 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]"
                    : "bg-[#141310]/90 shadow-[0_-8px_40px_rgba(0,0,0,0.6)]"
                  }`}
                  style={{
                    maxHeight: collapsed ? 52 : 500,
                    opacity: collapsed ? 0.45 : 1,
                    transition: collapsed
                      ? "max-height 350ms cubic-bezier(0.32, 0, 0.67, 0), opacity 200ms"
                      : "max-height 550ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms 50ms",
                  }}
                >
                  {/* ── Mode tabs + model selector (hidden when collapsed) ── */}
                  <div
                    style={{
                      maxHeight: collapsed ? 0 : 300,
                      opacity: collapsed ? 0 : 1,
                      overflow: "hidden",
                      transition: collapsed
                        ? "max-height 280ms cubic-bezier(0.32, 0, 0.67, 0), opacity 150ms"
                        : "max-height 550ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms 80ms",
                    }}
                  >
                    {/* Mode toggle row */}
                    <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                      <div className="flex items-center gap-0.5 rounded-lg border border-white/8 bg-white/3 px-1 py-0.5">
                        {(Object.entries(MODE_CONFIG) as [GenMode, typeof MODE_CONFIG["image"]][]).map(([mode, cfg]) => {
                          const Icon = cfg.icon
                          return (
                            <button
                              key={mode}
                              onClick={() => setGenMode(mode)}
                              className={`flex items-center gap-1 rounded px-2 py-1 text-[9px] font-medium uppercase tracking-wider transition-colors ${
                                genMode === mode ? cfg.activeColor : cfg.color + " hover:text-white/40"
                              }`}
                            >
                              <Icon size={10} />
                              {cfg.label}
                            </button>
                          )
                        })}
                      </div>

                      <div className="flex-1" />

                      {/* Credit cost badge */}
                      {activeModelDef?.creditCost && (
                        <span className="text-[9px] tabular-nums text-white/15">
                          ~{activeModelDef.creditCost} cr
                        </span>
                      )}
                    </div>

                    {/* Model pills row */}
                    <div className="flex flex-wrap items-center gap-1 px-4 py-1.5">
                      {modelsForMode.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setActiveModel(m.id)}
                          className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                            activeModelId === m.id
                              ? `bg-[${accent}]/15 text-[${accent}]`
                              : "bg-white/3 text-white/30 hover:bg-white/5 hover:text-white/50"
                          }`}
                          style={activeModelId === m.id ? { backgroundColor: `${accent}20`, color: accent } : undefined}
                        >
                          <span className="mr-1 text-[8px] opacity-40">{m.tag}</span>
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* ── Adaptive input area ── */}
                    <div className="flex items-center gap-2 px-4 py-2">
                      {/* Image refs — for image gen */}
                      {genMode === "image" && (
                        <>
                          {refImages.map((ref, i) => (
                            <div key={i} className="group/ref relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-white/10">
                              <img src={ref.url} alt="" className="h-full w-full object-cover" />
                              <button
                                onClick={() => setRefImages((prev) => prev.filter((_, j) => j !== i))}
                                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover/ref:opacity-100"
                              >
                                <X size={12} className="text-white/80" />
                              </button>
                            </div>
                          ))}
                          {Array.from({ length: Math.max(0, maxRefs - refImages.length) }, (_, i) => (
                            <button
                              key={`empty-${i}`}
                              onClick={() => refInputRef.current?.click()}
                              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-dashed transition-colors ${
                                refDropHover
                                  ? "border-[#D4A853]/40 bg-[#D4A853]/5"
                                  : "border-white/10 hover:border-white/20 hover:bg-white/[0.03]"
                              }`}
                            >
                              <Plus size={12} className={refDropHover ? "text-[#D4A853]/50" : "text-white/15"} />
                            </button>
                          ))}
                          <span className="ml-1 text-[9px] tabular-nums text-white/15">
                            {refImages.length}/{maxRefs}
                          </span>
                        </>
                      )}

                      {/* Source image — for i2v / lipsync / motion */}
                      {modelInputs.needsImage && genMode !== "image" && (
                        <div className="flex items-center gap-2">
                          {sourceImage ? (
                            <div className="group/src relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: `${accent}40` }}>
                              <img src={sourceImage.url} alt="" className="h-full w-full object-cover" />
                              <button
                                onClick={() => setSourceImage(null)}
                                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover/src:opacity-100"
                              >
                                <X size={12} className="text-white/80" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                const inp = document.createElement("input")
                                inp.type = "file"; inp.accept = "image/*"
                                inp.onchange = () => {
                                  const f = inp.files?.[0]; if (!f) return
                                  const reader = new FileReader()
                                  reader.onload = () => {
                                    if (typeof reader.result === "string") {
                                      setSourceImage({ url: reader.result, dataUrl: reader.result })
                                    }
                                  }
                                  reader.readAsDataURL(f)
                                }
                                inp.click()
                              }}
                              className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed transition-colors"
                              style={{ borderColor: `${accent}30` }}
                            >
                              <ImageIcon size={14} style={{ color: `${accent}80` }} />
                              <span className="text-[7px] uppercase" style={{ color: `${accent}60` }}>Source</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Audio — for lipsync */}
                      {modelInputs.needsAudio && (
                        <div className="flex items-center gap-2">
                          {audioFile ? (
                            <div className="group/aud flex h-14 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3">
                              <Mic size={12} className="text-emerald-400" />
                              <span className="max-w-[100px] truncate text-[10px] text-emerald-400/80">{audioFile.name}</span>
                              <button onClick={() => setAudioFile(null)} className="text-emerald-400/30 hover:text-emerald-400"><X size={10} /></button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                const inp = document.createElement("input")
                                inp.type = "file"; inp.accept = "audio/*"
                                inp.onchange = () => {
                                  const f = inp.files?.[0]; if (!f) return
                                  const reader = new FileReader()
                                  reader.onload = () => {
                                    if (typeof reader.result === "string") {
                                      setAudioFile({ name: f.name, dataUrl: reader.result })
                                    }
                                  }
                                  reader.readAsDataURL(f)
                                }
                                inp.click()
                              }}
                              className="flex h-14 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-emerald-500/30 px-4 transition-colors hover:bg-emerald-500/5"
                            >
                              <Mic size={14} className="text-emerald-400/60" />
                              <span className="text-[7px] uppercase text-emerald-400/40">Audio</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Motion video — for motion control */}
                      {modelInputs.needsMotionVideo && (
                        <div className="flex items-center gap-2">
                          {motionVideo ? (
                            <div className="group/mot flex h-14 items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3">
                              <Film size={12} className="text-cyan-400" />
                              <span className="max-w-[100px] truncate text-[10px] text-cyan-400/80">{motionVideo.name}</span>
                              <button onClick={() => setMotionVideo(null)} className="text-cyan-400/30 hover:text-cyan-400"><X size={10} /></button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                const inp = document.createElement("input")
                                inp.type = "file"; inp.accept = "video/*"
                                inp.onchange = () => {
                                  const f = inp.files?.[0]; if (!f) return
                                  const reader = new FileReader()
                                  reader.onload = () => {
                                    if (typeof reader.result === "string") {
                                      setMotionVideo({ name: f.name, dataUrl: reader.result })
                                    }
                                  }
                                  reader.readAsDataURL(f)
                                }
                                inp.click()
                              }}
                              className="flex h-14 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-cyan-500/30 px-4 transition-colors hover:bg-cyan-500/5"
                            >
                              <Film size={14} className="text-cyan-400/60" />
                              <span className="text-[7px] uppercase text-cyan-400/40">Motion</span>
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex-1" />

                      <span className="text-[9px] text-white/15">
                        {activeModelDef?.label || activeModelId}
                      </span>
                    </div>

                    <input
                      ref={refInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => { void addRefFromFile(e.target.files); e.target.value = "" }}
                      className="hidden"
                    />

                    {/* Active queue indicator */}
                    {activeJobs.length > 0 && (
                      <div className="flex items-center gap-2 border-t border-white/5 px-4 py-1.5">
                        <Loader2 size={10} className="animate-spin" style={{ color: accent }} />
                        <span className="text-[10px]" style={{ color: `${accent}99` }}>
                          {activeJobs.length} {activeJobs.length === 1 ? "generation" : "generations"} running
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ── Main input row (always visible) ── */}
                  <div
                    className="flex items-center gap-2 border-t border-white/[0.04] px-4"
                    style={{
                      padding: collapsed ? "8px 16px" : "12px 16px",
                      transition: collapsed
                        ? "padding 300ms cubic-bezier(0.32, 0, 0.67, 0)"
                        : "padding 450ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  >
                    <textarea
                      ref={promptRef}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          void handleGenerate()
                        }
                      }}
                      placeholder={
                        collapsed ? "Generate..." :
                        genMode === "image" ? "Describe what you want to generate..." :
                        genMode === "video" ? "Describe the video scene..." :
                        genMode === "lipsync" ? "Lipsync — drag source image + audio" :
                        "Motion control — drag source image + motion video"
                      }
                      rows={1}
                      className="flex-1 resize-none bg-transparent text-[13px] leading-[1.5] text-white/85 outline-none placeholder:text-white/20"
                      style={{
                        maxHeight: collapsed ? 24 : 120,
                        minHeight: collapsed ? 24 : 36,
                        transition: collapsed
                          ? "max-height 300ms cubic-bezier(0.32, 0, 0.67, 0), min-height 300ms"
                          : "max-height 450ms cubic-bezier(0.22, 1, 0.36, 1), min-height 450ms",
                        fieldSizing: "content",
                      } as React.CSSProperties}
                    />

                    {/* Controls */}
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {/* Batch count — only for image mode, hidden when collapsed */}
                      {genMode === "image" && (
                        <div
                          className="flex items-center gap-0.5 rounded-lg bg-white/[0.03] px-1 py-0.5"
                          style={{
                            width: collapsed ? 0 : "auto",
                            opacity: collapsed ? 0 : 1,
                            overflow: "hidden",
                            transition: collapsed
                              ? "width 250ms cubic-bezier(0.32, 0, 0.67, 0), opacity 150ms"
                              : "width 450ms cubic-bezier(0.22, 1, 0.36, 1) 140ms, opacity 350ms 170ms",
                          }}
                        >
                          {[1, 2, 3, 4].map((n) => (
                            <button
                              key={n}
                              onClick={() => setBatchCount(n)}
                              className={`flex h-5 w-5 items-center justify-center rounded text-[10px] transition-colors ${
                                batchCount === n ? "text-[#D4A853]" : "text-white/20 hover:text-white/40"
                              }`}
                              style={batchCount === n ? { backgroundColor: `${accent}20`, color: accent } : undefined}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Generate — always visible */}
                      <button
                        onClick={() => handleGenerate()}
                        disabled={(modelInputs.needsPrompt && !prompt.trim()) || (modelInputs.needsImage && genMode !== "image" && !sourceImage)}
                        className="flex items-center justify-center rounded-xl text-black transition-colors hover:brightness-110 disabled:opacity-25 disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: accent,
                          width: collapsed ? 28 : 32,
                          height: collapsed ? 28 : 32,
                          transition: collapsed
                            ? "width 300ms cubic-bezier(0.32, 0, 0.67, 0), height 300ms"
                            : "width 450ms cubic-bezier(0.22, 1, 0.36, 1), height 450ms",
                        }}
                      >
                        {activeJobs.length > 0 ? (
                          <div className="relative">
                            <Sparkles size={14} />
                            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/50 text-[7px] font-bold text-white">
                              {activeJobs.length}
                            </span>
                          </div>
                        ) : (
                          <Sparkles size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── Video Player overlay ── */}
      {videoPreview && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/90 backdrop-blur-md"
          onClick={() => setVideoPreview(null)}
        >
          <div
            className="relative flex max-h-[85vh] max-w-[85vw] flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setVideoPreview(null)}
              className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
            >
              <X size={14} />
            </button>

            {/* Video */}
            <video
              src={videoPreview.url}
              controls
              autoPlay
              loop
              className="max-h-[75vh] max-w-[85vw] rounded-xl"
              style={{ boxShadow: "0 0 80px rgba(168, 85, 247, 0.15)" }}
            />

            {/* Info bar */}
            <div className="mt-3 flex items-center gap-3">
              {videoPreview.prompt && (
                <span className="max-w-[400px] truncate text-[11px] text-white/30">{videoPreview.prompt}</span>
              )}
              {videoPreview.model && (
                <span className="rounded bg-purple-500/15 px-2 py-0.5 text-[9px] font-medium text-purple-400">
                  {getGenerationModelById(videoPreview.model)?.label || videoPreview.model}
                </span>
              )}
              <button
                onClick={() => {
                  const a = document.createElement("a")
                  a.href = videoPreview.url
                  a.download = videoPreview.name
                  a.click()
                }}
                className="flex items-center gap-1 rounded bg-white/5 px-2.5 py-1 text-[10px] text-white/40 transition-colors hover:bg-white/10 hover:text-white/60"
              >
                <Download size={10} />
                Download
              </button>
              <button
                onClick={() => {
                  void handleDelete(videoPreview)
                  setVideoPreview(null)
                }}
                className="flex items-center gap-1 rounded bg-white/5 px-2.5 py-1 text-[10px] text-red-400/50 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 size={10} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ShotStudio overlay ── */}
      {studioShotId && (
        <div className="fixed inset-0 z-[180]">
          <ShotStudio
            shotId={studioShotId}
            standalone
            onClose={handleStudioClose}
          />
        </div>
      )}
    </div>
  )
}
