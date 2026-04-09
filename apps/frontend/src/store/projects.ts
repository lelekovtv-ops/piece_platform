import { create } from "zustand"
import {
  fetchProjects,
  createProject as apiCreate,
  updateProject as apiUpdate,
  deleteProject as apiDelete,
  type ProjectData,
} from "@/lib/api/projects"

export interface Project {
  id: string
  name: string
  description: string
  ownerId: string
  createdAt: string
  updatedAt: string
}

interface ProjectsState {
  projects: Project[]
  activeProjectId: string | null
  isLoading: boolean
  error: string | null

  loadProjects: () => Promise<void>
  createProject: (name: string, description?: string) => Promise<string>
  updateProjectName: (id: string, name: string) => Promise<void>
  openProject: (id: string) => void
  deleteProject: (id: string) => Promise<void>
  closeProject: () => void
  reset: () => void
}

function toProject(d: ProjectData): Project {
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    ownerId: d.ownerId,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

export const useProjectsStore = create<ProjectsState>()((set, get) => ({
  projects: [],
  activeProjectId: null,
  isLoading: false,
  error: null,

  loadProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await fetchProjects({ limit: 100 })
      set({ projects: result.data.map(toProject), isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load projects"
      set({ error: message, isLoading: false })
    }
  },

  createProject: async (name, description) => {
    set({ error: null })
    try {
      const created = await apiCreate({ name: name.trim() || "Untitled Project", description })
      const project = toProject(created)
      set((state) => ({
        projects: [project, ...state.projects],
        activeProjectId: project.id,
      }))
      return project.id
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project"
      set({ error: message })
      throw err
    }
  },

  updateProjectName: async (id, name) => {
    const normalized = name.trim()
    if (!normalized) return

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, name: normalized, updatedAt: new Date().toISOString() } : p,
      ),
    }))

    try {
      await apiUpdate(id, { name: normalized })
    } catch (err) {
      await get().loadProjects()
      const message = err instanceof Error ? err.message : "Failed to update project"
      set({ error: message })
    }
  },

  openProject: (id) => {
    const exists = get().projects.some((p) => p.id === id)
    if (!exists) return
    set({ activeProjectId: id })
  },

  deleteProject: async (id) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
      error: null,
    }))

    try {
      await apiDelete(id)
    } catch (err) {
      await get().loadProjects()
      const message = err instanceof Error ? err.message : "Failed to delete project"
      set({ error: message })
    }
  },

  closeProject: () => set({ activeProjectId: null }),

  reset: () => set({ projects: [], activeProjectId: null, isLoading: false, error: null }),
}))
