import { randomBytes } from 'node:crypto'
import type { Session, CreateSessionInput, UpdateSessionInput } from '@melody-sync/types'
import { db } from '../db'

function genId(): string {
  return 'sess_' + randomBytes(8).toString('hex')
}

function now(): string {
  return new Date().toISOString()
}

type SessionRow = {
  id: string
  name: string
  folder: string
  tool: string | null
  model: string | null
  effort: string | null
  thinking: number
  workflow_state: string | null
  workflow_priority: string | null
  task_list_origin: string | null
  task_list_visibility: string | null
  lt_role: string | null
  lt_bucket: string | null
  persistent_kind: string | null
  builtin_name: string | null
  project_session_id: string | null
  forked_from_session_id: string | null
  root_session_id: string | null
  source_id: string | null
  external_trigger_id: string | null
  pinned: number
  archived: number
  archived_at: string | null
  active_run_id: string | null
  ordinal: number
  data: string
  created_at: string
  updated_at: string
}

function rowToSession(row: SessionRow): Session {
  const base = JSON.parse(row.data) as Session
  return {
    ...base,
    id: row.id,
    name: row.name,
    folder: row.folder,
    ordinal: row.ordinal,
    pinned: row.pinned === 1,
    archived: row.archived === 1,
    archivedAt: row.archived_at ?? undefined,
    activeRunId: row.active_run_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function nextOrdinal(): number {
  const row = db.query<{ max_ordinal: number | null }, []>(
    'SELECT MAX(ordinal) as max_ordinal FROM sessions'
  ).get()
  return (row?.max_ordinal ?? 0) + 1
}

function upsertRow(s: Session): void {
  db.run(
    `INSERT OR REPLACE INTO sessions (
      id, name, folder, tool, model, effort, thinking,
      workflow_state, workflow_priority, task_list_origin, task_list_visibility,
      lt_role, lt_bucket, persistent_kind, builtin_name,
      project_session_id, forked_from_session_id, root_session_id,
      source_id, external_trigger_id,
      pinned, archived, archived_at, active_run_id,
      ordinal, data, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      s.id, s.name, s.folder,
      s.tool ?? null, s.model ?? null, s.effort ?? null, s.thinking ? 1 : 0,
      s.workflowState ?? '', s.workflowPriority ?? null,
      s.taskListOrigin ?? null, s.taskListVisibility ?? null,
      s.ltRole ?? null, s.ltBucket ?? null, s.persistentKind ?? null, s.builtinName ?? null,
      s.projectSessionId ?? null, s.forkedFromSessionId ?? null, s.rootSessionId ?? null,
      s.sourceId ?? null, s.externalTriggerId ?? null,
      s.pinned ? 1 : 0, s.archived ? 1 : 0, s.archivedAt ?? null, s.activeRunId ?? null,
      s.ordinal, JSON.stringify(s), s.createdAt, s.updatedAt,
    ]
  )
}

// ─── public API ───────────────────────────────────────────────────────────────

export interface ListSessionsOpts {
  folder?: string
  archived?: boolean
  visibility?: string
}

export function listSessions(opts: ListSessionsOpts = {}): Session[] {
  const conditions: string[] = []
  const params: (string | number)[] = []

  if (opts.folder !== undefined) {
    conditions.push('folder = ?')
    params.push(opts.folder)
  }

  if (opts.archived !== undefined) {
    conditions.push('archived = ?')
    params.push(opts.archived ? 1 : 0)
  } else {
    conditions.push('archived = 0')
  }

  if (opts.visibility !== undefined) {
    conditions.push('task_list_visibility = ?')
    params.push(opts.visibility)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.query<SessionRow, (string | number)[]>(
    `SELECT * FROM sessions ${where} ORDER BY ordinal DESC`
  ).all(...params)

  return rows.map(rowToSession)
}

export function getSession(id: string): Session | null {
  const row = db.query<SessionRow, [string]>(
    'SELECT * FROM sessions WHERE id = ?'
  ).get(id)
  return row ? rowToSession(row) : null
}

export function createSession(input: CreateSessionInput): Session {
  const id = genId()
  const ts = now()
  const ordinal = nextOrdinal()

  const session: Session = {
    id,
    name: input.name ?? 'Untitled',
    folder: input.folder ?? '~',
    tool: input.tool,
    model: input.model,
    effort: input.effort,
    thinking: input.thinking ?? false,
    workflowState: '',
    taskListOrigin: input.taskListOrigin,
    taskListVisibility: input.taskListVisibility,
    ltBucket: input.ltBucket,
    forkedFromSessionId: input.forkedFromSessionId,
    rootSessionId: input.forkedFromSessionId,
    pinned: false,
    archived: false,
    ordinal,
    createdAt: ts,
    updatedAt: ts,
  }

  upsertRow(session)
  return session
}

export function updateSession(id: string, input: UpdateSessionInput): Session {
  const existing = getSession(id)
  if (!existing) throw new Error(`Session not found: ${id}`)

  const updated: Session = {
    ...existing,
    ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
    updatedAt: now(),
  }

  upsertRow(updated)
  return updated
}

export function deleteSession(id: string): void {
  db.run('DELETE FROM sessions WHERE id = ?', [id])
}

export function archiveSession(id: string): Session {
  const existing = getSession(id)
  if (!existing) throw new Error(`Session not found: ${id}`)

  const ts = now()
  const updated: Session = { ...existing, archived: true, archivedAt: ts, updatedAt: ts }
  upsertRow(updated)
  return updated
}

export function pinSession(id: string, pinned: boolean): Session {
  return updateSession(id, { pinned })
}
