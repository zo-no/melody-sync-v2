import type {
  ApiResult,
  PagedResult,
  Project,
  CreateProjectInput,
  UpdateProjectInput,
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

// ── Projects ──────────────────────────────────────────────────────────────────

export function getProjects(): Promise<ApiResult<Project[]>> {
  return request<Project[]>('GET', '/projects')
}

export function getProject(id: string): Promise<ApiResult<Project>> {
  return request<Project>('GET', `/projects/${id}`)
}

export function createProject(input: CreateProjectInput): Promise<ApiResult<Project>> {
  return request<Project>('POST', '/projects', input)
}

export function updateProject(id: string, input: UpdateProjectInput): Promise<ApiResult<Project>> {
  return request<Project>('PATCH', `/projects/${id}`, input)
}

export function deleteProject(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  return request<{ deleted: boolean }>('DELETE', `/projects/${id}`)
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export function getSessions(
  opts?: { projectId?: string; archived?: boolean }
): Promise<ApiResult<Session[]>> {
  const params = new URLSearchParams()
  if (opts?.projectId !== undefined) params.set('projectId', opts.projectId)
  if (opts?.archived !== undefined) params.set('archived', String(opts.archived))
  const qs = params.toString()
  return request<Session[]>('GET', `/sessions${qs ? `?${qs}` : ''}`)
}

export function getSession(id: string): Promise<ApiResult<Session>> {
  return request<Session>('GET', `/sessions/${id}`)
}

export function createSession(input: CreateSessionInput): Promise<ApiResult<Session>> {
  return request<Session>('POST', '/sessions', input)
}

export function updateSession(id: string, input: UpdateSessionInput): Promise<ApiResult<Session>> {
  return request<Session>('PATCH', `/sessions/${id}`, input)
}

export function deleteSession(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  return request<{ deleted: boolean }>('DELETE', `/sessions/${id}`)
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

export function sendMessage(id: string, input: SendMessageInput): Promise<ApiResult<{ queued: boolean; run: Run | null; session: Session }>> {
  return request('POST', `/sessions/${id}/messages`, input)
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
