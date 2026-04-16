import { create } from 'zustand'
import type { Run, SendMessageInput, SessionEvent } from '@melody-sync/types'
import * as api from '@/api/client'
import { useSessionStore } from '@/controllers/session'

interface ChatState {
  events: SessionEvent[]
  sending: boolean
  draft: string
  runs: Run[]
  sendError: string | null
}

interface ChatActions {
  fetchEvents(sessionId: string): Promise<void>
  sendMessage(sessionId: string, input: SendMessageInput): Promise<void>
  setDraft(text: string): void
  fetchRuns(sessionId: string): Promise<void>
  cancelRun(runId: string): Promise<void>
}

type ChatStore = ChatState & ChatActions

export const useChatStore = create<ChatStore>((set, get) => ({
  events: [],
  sending: false,
  draft: '',
  runs: [],
  sendError: null,

  async fetchEvents(sessionId: string): Promise<void> {
    const result = await api.getSessionEvents(sessionId)
    if (result.ok) {
      set({ events: result.data.items })
    }
  },

  async sendMessage(sessionId: string, input: SendMessageInput): Promise<void> {
    const nextDraft = input.text.trim()
    if (!nextDraft) return

    set({ sending: true, draft: '', sendError: null })
    try {
      const result = await api.sendMessage(sessionId, { ...input, text: nextDraft })
      if (!result.ok) {
        set({ draft: nextDraft, sendError: result.error })
        return
      }

      const { hydrateSession, currentProjectId, fetchSessions } = useSessionStore.getState()
      if (result.data.session) {
        hydrateSession(result.data.session)
      }
      if (result.data.run) {
        set((state) => ({
          runs: [result.data.run!, ...state.runs.filter((run) => run.id !== result.data.run!.id)],
        }))
      }
      await get().fetchEvents(sessionId)
      if (currentProjectId) {
        await fetchSessions(currentProjectId)
      }
      set({ sendError: null })
    } finally {
      set({ sending: false })
    }
  },

  setDraft(text: string): void {
    set({ draft: text })
  },

  async fetchRuns(sessionId: string): Promise<void> {
    const result = await api.getSessionRuns(sessionId)
    if (result.ok) {
      set({ runs: result.data })
    }
  },

  async cancelRun(runId: string): Promise<void> {
    const result = await api.cancelRun(runId)
    if (result.ok) {
      set((state) => ({
        runs: state.runs.map((r) => (r.id === runId ? result.data : r)),
      }))
    }
  },
}))
