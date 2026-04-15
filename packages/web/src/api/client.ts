import type {
  ApiResult,
  PagedResult,
  Session,
  SessionEvent,
  Run,
  CreateSessionInput,
  UpdateSessionInput,
  SendMessageInput,
} from '@melody-sync/types'

const BASE = '/api'

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResult<T>> {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, init)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return { ok: false, error: `HTTP ${res.status}: invalid JSON response` }
  }

  return json as ApiResult<T>
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export function getSessions(
  opts?: { folder?: string; archived?: boolean }
): Promise<ApiResult<Session[]>> {
  const params = new URLSearchParams()
  if (opts?.folder !== undefined) params.set('folder', opts.folder)
  if (opts?.archived !== undefined) params.set('archived', String(opts.archived))
  const qs = params.toString()
  return request<Session[]>('GET', `/sessions${qs ? `?${qs}` : ''}`)
}

export function getSession(id: string): Promise<ApiResult<Session>> {
  return request<Session>('GET', `/sessions/${id}`)
}

export function createSession(
  input: CreateSessionInput
): Promise<ApiResult<Session>> {
  return request<Session>('POST', '/sessions', input)
}

export function updateSession(
  id: string,
  input: UpdateSessionInput
): Promise<ApiResult<Session>> {
  return request<Session>('PATCH', `/sessions/${id}`, input)
}

export function deleteSession(id: string): Promise<ApiResult<void>> {
  return request<void>('DELETE', `/sessions/${id}`)
}

export function archiveSession(id: string): Promise<ApiResult<Session>> {
  return request<Session>('POST', `/sessions/${id}/archive`)
}

export function pinSession(
  id: string,
  pinned: boolean
): Promise<ApiResult<Session>> {
  return request<Session>('POST', `/sessions/${id}/pin`, { pinned })
}

export function getSessionEvents(
  id: string,
  opts?: { limit?: number; offset?: number }
): Promise<ApiResult<PagedResult<SessionEvent>>> {
  const params = new URLSearchParams()
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset))
  const qs = params.toString()
  return request<PagedResult<SessionEvent>>(
    'GET',
    `/sessions/${id}/events${qs ? `?${qs}` : ''}`
  )
}

export function sendMessage(
  id: string,
  input: SendMessageInput
): Promise<ApiResult<{ message: string }>> {
  return request<{ message: string }>('POST', `/sessions/${id}/messages`, input)
}

// ── Runs ──────────────────────────────────────────────────────────────────────

export function getRun(id: string): Promise<ApiResult<Run>> {
  return request<Run>('GET', `/runs/${id}`)
}

export function getSessionRuns(sessionId: string): Promise<ApiResult<Run[]>> {
  return request<Run[]>('GET', `/sessions/${sessionId}/runs`)
}

export function cancelRun(id: string): Promise<ApiResult<Run>> {
  return request<Run>('POST', `/runs/${id}/cancel`)
}
