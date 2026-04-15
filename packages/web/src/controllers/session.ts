import { create } from 'zustand'
import type { Session, CreateSessionInput, UpdateSessionInput } from '@melody-sync/types'
import * as api from '@/api/client'

interface SessionState {
  sessions: Session[]
  currentSessionId: string | null
  loading: boolean
  error: string | null
}

interface SessionActions {
  fetchSessions(): Promise<void>
  selectSession(id: string): void
  createSession(input: CreateSessionInput): Promise<Session>
  updateSession(id: string, input: UpdateSessionInput): Promise<void>
  deleteSession(id: string): Promise<void>
  archiveSession(id: string): Promise<void>
  pinSession(id: string, pinned: boolean): Promise<void>
  get currentSession(): Session | null
}

type SessionStore = SessionState & SessionActions

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  loading: false,
  error: null,

  get currentSession(): Session | null {
    const { sessions, currentSessionId } = get()
    if (!currentSessionId) return null
    return sessions.find((s) => s.id === currentSessionId) ?? null
  },

  async fetchSessions(): Promise<void> {
    set({ loading: true, error: null })
    const result = await api.getSessions()
    if (result.ok) {
      set({ sessions: result.data, loading: false })
    } else {
      set({ error: result.error, loading: false })
    }
  },

  selectSession(id: string): void {
    set({ currentSessionId: id })
  },

  async createSession(input: CreateSessionInput): Promise<Session> {
    const result = await api.createSession(input)
    if (!result.ok) throw new Error(result.error)
    const session = result.data
    set((state) => ({ sessions: [session, ...state.sessions] }))
    return session
  },

  async updateSession(id: string, input: UpdateSessionInput): Promise<void> {
    const result = await api.updateSession(id, input)
    if (!result.ok) throw new Error(result.error)
    const updated = result.data
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? updated : s)),
    }))
  },

  async deleteSession(id: string): Promise<void> {
    const result = await api.deleteSession(id)
    if (!result.ok) throw new Error(result.error)
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSessionId:
        state.currentSessionId === id ? null : state.currentSessionId,
    }))
  },

  async archiveSession(id: string): Promise<void> {
    const result = await api.archiveSession(id)
    if (!result.ok) throw new Error(result.error)
    const updated = result.data
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? updated : s)),
    }))
  },

  async pinSession(id: string, pinned: boolean): Promise<void> {
    const result = await api.pinSession(id, pinned)
    if (!result.ok) throw new Error(result.error)
    const updated = result.data
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? updated : s)),
    }))
  },
}))
