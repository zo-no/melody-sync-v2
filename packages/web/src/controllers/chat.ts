import { create } from 'zustand'
import type { SessionEvent, Run } from '@melody-sync/types'
import * as api from '@/api/client'

interface ChatState {
  events: SessionEvent[]
  sending: boolean
  draft: string
  runs: Run[]
}

interface ChatActions {
  fetchEvents(sessionId: string): Promise<void>
  sendMessage(sessionId: string, text: string): Promise<void>
  setDraft(text: string): void
  fetchRuns(sessionId: string): Promise<void>
  cancelRun(runId: string): Promise<void>
}

type ChatStore = ChatState & ChatActions

export const useChatStore = create<ChatStore>((set) => ({
  events: [],
  sending: false,
  draft: '',
  runs: [],

  async fetchEvents(sessionId: string): Promise<void> {
    const result = await api.getSessionEvents(sessionId)
    if (result.ok) {
      set({ events: result.data.items })
    }
  },

  async sendMessage(sessionId: string, text: string): Promise<void> {
    set({ sending: true, draft: '' })
    try {
      await api.sendMessage(sessionId, { text })
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
