// API response wrappers — shared between server routes and web client

export interface ApiOk<T> {
  ok: true
  data: T
}

export interface ApiErr {
  ok: false
  error: string
  code?: string
}

export type ApiResult<T> = ApiOk<T> | ApiErr

// Pagination
export interface PagedResult<T> {
  items: T[]
  total: number
  offset: number
  limit: number
}

// Session event (history)
export type EventType =
  | 'message'
  | 'reasoning'
  | 'tool_use'
  | 'tool_result'
  | 'status'
  | 'file_change'
  | 'usage'

export type EventRole = 'user' | 'assistant'

export interface SessionEvent {
  seq: number
  timestamp: number
  type: EventType
  role?: EventRole
  content?: string       // message / reasoning
  toolInput?: string     // tool_use
  output?: string        // tool_result
  bodyRef?: string
  bodyBytes?: number
  bodyPreview?: string
  bodyTruncated?: boolean
}

// Message submission
export interface SendMessageInput {
  text: string
  requestId?: string
  tool?: string
  model?: string | null
  effort?: string | null
  thinking?: boolean
  attachments?: MessageAttachment[]
}

export interface MessageAttachment {
  type: 'file' | 'image'
  assetId?: string
  name: string
  mimeType: string
}

// WebSocket invalidation hint
export type WsMessage =
  | { type: 'session_invalidated'; sessionId: string }
  | { type: 'sessions_invalidated'; projectId: string }
  | { type: 'projects_invalidated' }
  | { type: 'run_delta'; runId: string; sessionId: string; delta: unknown }
