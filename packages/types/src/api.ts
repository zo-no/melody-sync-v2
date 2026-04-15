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
export type EventType = 'message' | 'reasoning' | 'tool_use' | 'tool_result' | 'status'
export type EventRole = 'user' | 'assistant'

export interface SessionEvent {
  seq: number
  timestamp: number
  type: EventType
  role?: EventRole
  content?: string
  toolInput?: string
  output?: string
  bodyLoaded: boolean
  bodyTruncated?: boolean
  bodyBytes?: number
}

// Message submission
export interface SendMessageInput {
  text: string
  attachments?: MessageAttachment[]
  requestId?: string
}

export interface MessageAttachment {
  type: 'file' | 'image'
  assetId?: string
  name: string
  mimeType: string
}

// WebSocket invalidation hint
export interface WsInvalidation {
  type: 'session' | 'run' | 'workbench'
  id: string
  event: string
}
