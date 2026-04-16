import { create } from 'zustand'
import type { Session, CreateSessionInput, UpdateSessionInput } from '@melody-sync/types'
import * as api from '@/api/client'

interface SessionState {
  sessions: Session[]
  currentSessionId: string | null
  currentProjectId: string | null
  loading: boolean
  error: string | null
}

interface SessionActions {
  fetchSessions(projectId?: string): Promise<void>
  refreshSession(id: string): Promise<void>
  hydrateSession(session: Session): void
  selectSession(id: string): void
  createSession(input: CreateSessionInput): Promise<Session>
  updateSession(id: string, input: UpdateSessionInput): Promise<void>
  deleteSession(id: string): Promise<void>
  archiveSession(id: string): Promise<void>
  pinSession(id: string, pinned: boolean): Promise<void>
  setCurrentProject(projectId: string | null): void
}

type SessionStore = SessionState & SessionActions

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  currentProjectId: null,
  loading: false,
  error: null,

  async fetchSessions(projectId?: string): Promise<void> {
    set({ loading: true, error: null })
    const result = await api.getSessions({ projectId })
    if (result.ok) {
      const previousCurrentSessionId = get().currentSessionId
      const nextCurrentSessionId = previousCurrentSessionId && result.data.some((session) => session.id === previousCurrentSessionId)
        ? previousCurrentSessionId
        : (result.data[0]?.id ?? null)
      set({
        sessions: result.data,
        currentSessionId: nextCurrentSessionId,
        loading: false,
      })
    } else {
      set({ error: result.error, loading: false })
    }
  },

  async refreshSession(id: string): Promise<void> {
    const result = await api.getSession(id)
    if (!result.ok) return
    get().hydrateSession(result.data)
  },

  hydrateSession(session: Session): void {
    set((state) => {
      const existing = state.sessions.some((item) => item.id === session.id)
      return {
        sessions: existing
          ? state.sessions.map((item) => (item.id === session.id ? session : item))
          : [session, ...state.sessions],
        currentSessionId: state.currentSessionId ?? session.id,
      }
    })
  },

  selectSession(id: string): void {
    set({ currentSessionId: id })
  },

  setCurrentProject(projectId: string | null): void {
    set({ currentProjectId: projectId, currentSessionId: null, sessions: [] })
  },

  async createSession(input: CreateSessionInput): Promise<Session> {
    const result = await api.createSession(input)
    if (!result.ok) throw new Error(result.error)
    set((state) => ({ sessions: [result.data, ...state.sessions] }))
    return result.data
  },

  async updateSession(id: string, input: UpdateSessionInput): Promise<void> {
    const result = await api.updateSession(id, input)
    if (!result.ok) throw new Error(result.error)
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? result.data : s)),
    }))
  },

  async deleteSession(id: string): Promise<void> {
    const result = await api.deleteSession(id)
    if (!result.ok) throw new Error(result.error)
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSessionId: state.currentSessionId === id
        ? (state.sessions.find((s) => s.id !== id)?.id ?? null)
        : state.currentSessionId,
    }))
  },

  async archiveSession(id: string): Promise<void> {
    const result = await api.updateSession(id, { archived: true })
    if (!result.ok) throw new Error(result.error)
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSessionId: state.currentSessionId === id
        ? (state.sessions.find((s) => s.id !== id)?.id ?? null)
        : state.currentSessionId,
    }))
  },

  async pinSession(id: string, pinned: boolean): Promise<void> {
    const result = await api.updateSession(id, { pinned })
    if (!result.ok) throw new Error(result.error)
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? result.data : s)),
    }))
  },
}))
