import { randomBytes } from 'node:crypto'
import type { Session, CreateSessionInput, UpdateSessionInput } from '@melody-sync/types'
import { getDb } from '../db'

function genId(): string {
  return 'sess_' + randomBytes(8).toString('hex')
}

function now(): string {
  return new Date().toISOString()
}

type SessionRow = {
  id: string
  project_id: string
  name: string
  auto_rename_pending: number
  model: string | null
  effort: string | null
  thinking: number
  active_run_id: string | null
  follow_up_queue: string
  pinned: number
  archived: number
  archived_at: string | null
  created_at: string
  updated_at: string
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    autoRenamePending: row.auto_rename_pending === 1 ? true : undefined,
    model: row.model ?? undefined,
    effort: row.effort ?? undefined,
    thinking: row.thinking === 1 ? true : undefined,
    activeRunId: row.active_run_id ?? undefined,
    pinned: row.pinned === 1 ? true : undefined,
    archived: row.archived === 1 ? true : undefined,
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── public API ───────────────────────────────────────────────────────────────

export interface ListSessionsOpts {
  projectId?: string
  archived?: boolean
}

export function listSessions(opts: ListSessionsOpts = {}): Session[] {
  const db = getDb()
  const archived = opts.archived ?? false

  if (opts.projectId) {
    const rows = db.query<SessionRow, [string, number]>(
      `SELECT * FROM sessions WHERE project_id = ? AND archived = ? ORDER BY pinned DESC, updated_at DESC`
    ).all(opts.projectId, archived ? 1 : 0)
    return rows.map(rowToSession)
  }

  const rows = db.query<SessionRow, [number]>(
    `SELECT * FROM sessions WHERE archived = ? ORDER BY pinned DESC, updated_at DESC`
  ).all(archived ? 1 : 0)
  return rows.map(rowToSession)
}

export function getSession(id: string): Session | null {
  const db = getDb()
  const row = db.query<SessionRow, [string]>(
    'SELECT * FROM sessions WHERE id = ?'
  ).get(id)
  return row ? rowToSession(row) : null
}

export function createSession(input: CreateSessionInput): Session {
  const db = getDb()
  const id = genId()
  const ts = now()

  db.run(
    `INSERT INTO sessions (id, project_id, name, auto_rename_pending, model, effort, thinking, pinned, archived, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?, ?, 0, 0, ?, ?)`,
    [
      id,
      input.projectId,
      input.name ?? 'New Session',
      input.model ?? null,
      input.effort ?? null,
      input.thinking ? 1 : 0,
      ts, ts,
    ]
  )

  return getSession(id)!
}

export function updateSession(id: string, input: UpdateSessionInput): Session {
  const existing = getSession(id)
  if (!existing) throw new Error(`Session not found: ${id}`)

  const db = getDb()
  const sets: string[] = ['updated_at = ?']
  const params: (string | number | null)[] = [now()]

  const fieldMap: Array<[keyof UpdateSessionInput, string]> = [
    ['name', 'name'],
    ['autoRenamePending', 'auto_rename_pending'],
    ['model', 'model'],
    ['effort', 'effort'],
    ['thinking', 'thinking'],
    ['pinned', 'pinned'],
    ['archived', 'archived'],
    ['activeRunId', 'active_run_id'],
  ]

  for (const [key, col] of fieldMap) {
    if (key in input) {
      sets.push(`${col} = ?`)
      const val = input[key]
      if (typeof val === 'boolean') {
        params.push(val ? 1 : 0)
      } else {
        params.push((val ?? null) as string | null)
      }
    }
  }

  if ('archived' in input) {
    sets.push('archived_at = ?')
    params.push(input.archived ? now() : null)
  }

  params.push(id)
  db.run(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`, params)
  return getSession(id)!
}

export function deleteSession(id: string): void {
  const db = getDb()
  db.run('DELETE FROM sessions WHERE id = ?', [id])
}

// ─── follow-up queue ──────────────────────────────────────────────────────────

export interface QueuedMessage {
  requestId: string
  text: string
}

export function getFollowUpQueue(id: string): QueuedMessage[] {
  const db = getDb()
  const row = db.query<{ follow_up_queue: string }, [string]>(
    'SELECT follow_up_queue FROM sessions WHERE id = ?'
  ).get(id)
  if (!row) return []
  try {
    return JSON.parse(row.follow_up_queue) as QueuedMessage[]
  } catch {
    return []
  }
}

export function enqueueFollowUp(id: string, msg: QueuedMessage): void {
  const db = getDb()
  const queue = getFollowUpQueue(id)
  if (queue.some((m) => m.requestId === msg.requestId)) return // dedup
  queue.push(msg)
  db.run(
    `UPDATE sessions SET follow_up_queue = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(queue), now(), id]
  )
}

export function dequeueFollowUp(id: string): QueuedMessage | null {
  const db = getDb()
  const queue = getFollowUpQueue(id)
  if (queue.length === 0) return null
  const [next, ...rest] = queue
  db.run(
    `UPDATE sessions SET follow_up_queue = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(rest), now(), id]
  )
  return next!
}
