"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { useProjectsStore } from "@/store/projects"
import { useScriptStore } from "@/store/script"
import { useTimelineStore } from "@/store/timeline"
import { useBibleStore } from "@/store/bible"
import { useDialogueStore } from "@/store/dialogue"
import { useVoiceTrackStore } from "@/store/voiceTrack"
import { useThemeStore } from "@/store/theme"
import { fetchProjectById } from "@/lib/api/projects"

const ScriptWriterOverlay = dynamic(
  () => import("@/components/editor/ScriptWriterOverlay"),
  { ssr: false },
)
const BoardAssistant = dynamic(
  () => import("@/components/board/BoardAssistant"),
  { ssr: false },
)

export default function ProjectPage() {
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { openProject, closeProject, loadProjects, projects } = useProjectsStore()
  const setActiveScriptProject = useScriptStore((s) => s.setActiveProject)
  const setActiveTimelineProject = useTimelineStore((s) => s.setActiveProject)
  const setActiveBibleProject = useBibleStore((s) => s.setActiveProject)
  const setActiveDialogueProject = useDialogueStore((s) => s.setActiveProject)
  const setActiveVoiceTrackProject = useVoiceTrackStore((s) => s.setActiveProject)

  const appTheme = useThemeStore((s) => s.theme)
  const pageBg =
    appTheme === "architect"
      ? "#080808"
      : appTheme === "synthwave"
        ? "#0a0614"
        : "#FAF6F1"

  useEffect(() => {
    const projectId = params.projectId
    if (!projectId) return

    let cancelled = false

    async function load() {
      try {
        await fetchProjectById(projectId)

        if (cancelled) return

        if (projects.length === 0) {
          await loadProjects()
        }

        openProject(projectId)
        setActiveScriptProject(projectId)
        setActiveTimelineProject(projectId)
        setActiveBibleProject(projectId)
        setActiveDialogueProject(projectId)
        setActiveVoiceTrackProject(projectId)
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError("Project not found or access denied")
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [
    params.projectId,
    openProject,
    loadProjects,
    projects.length,
    setActiveScriptProject,
    setActiveTimelineProject,
    setActiveBibleProject,
    setActiveDialogueProject,
    setActiveVoiceTrackProject,
  ])

  const handleBack = () => {
    closeProject()
    setActiveScriptProject(null)
    setActiveTimelineProject(null)
    setActiveBibleProject(null)
    setActiveDialogueProject(null)
    setActiveVoiceTrackProject(null)
    router.push("/")
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E0D0C]">
        <div className="text-sm text-white/30">Loading project...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E0D0C]">
        <div className="flex flex-col items-center gap-4">
          <div className="text-sm text-red-400/70">{error}</div>
          <button
            onClick={() => router.push("/")}
            className="text-xs text-white/40 hover:text-white/60 underline"
          >
            Back to projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen" style={{ backgroundColor: pageBg }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            appTheme === "architect"
              ? "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)"
              : appTheme === "synthwave"
                ? "radial-gradient(circle, rgba(255,45,149,0.15) 1px, transparent 1px)"
                : "radial-gradient(circle, rgba(141, 126, 109, 0.45) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      <ScriptWriterOverlay
        active
        type="new"
        initialRect={null}
        onCloseStart={handleBack}
        onCloseComplete={handleBack}
      />
      <BoardAssistant />
    </div>
  )
}
