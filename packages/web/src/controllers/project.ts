import { create } from 'zustand'
import type { Project, CreateProjectInput, UpdateProjectInput } from '@melody-sync/types'
import * as api from '@/api/client'

interface ProjectState {
  projects: Project[]
  currentProjectId: string | null
  loading: boolean
  error: string | null
}

interface ProjectActions {
  fetchProjects(): Promise<void>
  selectProject(id: string): void
  createProject(input: CreateProjectInput): Promise<Project>
  updateProject(id: string, input: UpdateProjectInput): Promise<void>
  deleteProject(id: string): Promise<void>
}

type ProjectStore = ProjectState & ProjectActions

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProjectId: null,
  loading: false,
  error: null,

  async fetchProjects(): Promise<void> {
    set({ loading: true, error: null })
    const result = await api.getProjects()
    if (result.ok) {
      const projects = result.data
      const currentId = get().currentProjectId
      // auto-select first project if none selected
      const nextId = currentId && projects.some((p) => p.id === currentId)
        ? currentId
        : (projects[0]?.id ?? null)
      set({ projects, currentProjectId: nextId, loading: false })
    } else {
      set({ error: result.error, loading: false })
    }
  },

  selectProject(id: string): void {
    set({ currentProjectId: id })
  },

  async createProject(input: CreateProjectInput): Promise<Project> {
    const result = await api.createProject(input)
    if (!result.ok) throw new Error(result.error)
    set((state) => ({
      projects: [result.data, ...state.projects],
      currentProjectId: state.currentProjectId ?? result.data.id,
    }))
    return result.data
  },

  async updateProject(id: string, input: UpdateProjectInput): Promise<void> {
    const result = await api.updateProject(id, input)
    if (!result.ok) throw new Error(result.error)
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? result.data : p)),
    }))
  },

  async deleteProject(id: string): Promise<void> {
    const result = await api.deleteProject(id)
    if (!result.ok) throw new Error(result.error)
    set((state) => {
      const projects = state.projects.filter((p) => p.id !== id)
      const currentProjectId = state.currentProjectId === id
        ? (projects[0]?.id ?? null)
        : state.currentProjectId
      return { projects, currentProjectId }
    })
  },
}))
