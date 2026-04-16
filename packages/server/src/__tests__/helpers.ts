/**
 * Test helpers — inject an in-memory SQLite DB and expose a thin HTTP client
 * that talks directly to the Hono app (no network).
 */
import { Database } from 'bun:sqlite'
import { setDb } from '../db'
import { app } from '../server'

// ── DB isolation ──────────────────────────────────────────────────────────────

let _mem: Database | null = null

export function setupTestDb(): Database {
  _mem = new Database(':memory:')
  _mem.run('PRAGMA journal_mode = WAL')
  _mem.run('PRAGMA foreign_keys = ON')
  _initSchema(_mem)
  setDb(_mem)
  return _mem
}

export function resetTestDb(): void {
  if (!_mem) return
  _mem.run('DELETE FROM session_events')
  _mem.run('DELETE FROM runs')
  _mem.run('DELETE FROM sessions')
  _mem.run('DELETE FROM projects')
  _mem.run('DELETE FROM auth')
  _mem.run('DELETE FROM auth_sessions')
  _mem.run('DELETE FROM settings')
}

function _initSchema(db: Database): void {
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, path TEXT NOT NULL,
    system_prompt TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  ) STRICT`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC)`)

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL, auto_rename_pending INTEGER DEFAULT 0,
    model TEXT, effort TEXT, thinking INTEGER DEFAULT 0,
    active_run_id TEXT, follow_up_queue TEXT NOT NULL DEFAULT '[]',
    pinned INTEGER DEFAULT 0, archived INTEGER DEFAULT 0, archived_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  ) STRICT`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id, pinned DESC, updated_at DESC)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_list ON sessions(archived, updated_at DESC)`)

  db.run(`CREATE TABLE IF NOT EXISTS session_events (
    id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL REFERENCES sessions(id),
    seq INTEGER NOT NULL, type TEXT NOT NULL, role TEXT,
    content TEXT, tool_input TEXT, output TEXT,
    body_ref TEXT, body_bytes INTEGER, body_preview TEXT,
    body_truncated INTEGER DEFAULT 0, timestamp INTEGER NOT NULL, created_at TEXT NOT NULL
  ) STRICT`)
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_session_events_seq ON session_events(session_id, seq)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(session_id, timestamp DESC)`)

  db.run(`CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL REFERENCES sessions(id),
    request_id TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'accepted',
    model TEXT NOT NULL, effort TEXT, thinking INTEGER DEFAULT 0,
    cancel_requested INTEGER DEFAULT 0, result TEXT, failure_reason TEXT,
    runner_process_id INTEGER, context_input_tokens INTEGER, context_window_tokens INTEGER,
    created_at TEXT NOT NULL, started_at TEXT, updated_at TEXT NOT NULL,
    completed_at TEXT, finalized_at TEXT
  ) STRICT`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id, created_at DESC)`)

  db.run(`CREATE TABLE IF NOT EXISTS auth (
    id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, value TEXT NOT NULL, created_at TEXT NOT NULL
  ) STRICT`)
  db.run(`CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, last_seen TEXT NOT NULL, expires_at TEXT
  ) STRICT`)
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL
  ) STRICT`)
}

// ── HTTP client (no network) ──────────────────────────────────────────────────

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

export async function apiReq<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: ApiResult<T> }> {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await app.request(`http://localhost${path}`, init)
  const json = (await res.json()) as ApiResult<T>
  return { status: res.status, json }
}

export const GET = <T = unknown>(path: string) => apiReq<T>('GET', path)
export const POST = <T = unknown>(path: string, body?: unknown) => apiReq<T>('POST', path, body)
export const PATCH = <T = unknown>(path: string, body: unknown) => apiReq<T>('PATCH', path, body)
export const DEL = (path: string) => apiReq('DELETE', path)
