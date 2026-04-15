import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function resolveDbPath(): string {
  const raw =
    process.env['MELODYSYNC_DB_PATH'] ??
    `${process.env['HOME'] ?? '~'}/.melodysync/runtime/sessions/sessions.db`

  return raw.startsWith('~/')
    ? resolve(process.env['HOME'] ?? '', raw.slice(2))
    : resolve(raw)
}

function initSchema(db: Database): void {
  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA foreign_keys = ON')

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id                    TEXT PRIMARY KEY NOT NULL,
    name                  TEXT NOT NULL,
    folder                TEXT NOT NULL DEFAULT '~',
    tool                  TEXT,
    model                 TEXT,
    effort                TEXT,
    thinking              INTEGER DEFAULT 0,
    workflow_state        TEXT DEFAULT '',
    workflow_priority     TEXT,
    task_list_origin      TEXT,
    task_list_visibility  TEXT,
    lt_role               TEXT,
    lt_bucket             TEXT,
    persistent_kind       TEXT,
    builtin_name          TEXT,
    project_session_id    TEXT,
    forked_from_session_id TEXT,
    root_session_id       TEXT,
    source_id             TEXT,
    external_trigger_id   TEXT,
    pinned                INTEGER DEFAULT 0,
    archived              INTEGER DEFAULT 0,
    archived_at           TEXT,
    active_run_id         TEXT,
    ordinal               INTEGER NOT NULL,
    data                  TEXT NOT NULL,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL
  ) STRICT`)

  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_list
    ON sessions (task_list_visibility, workflow_state, updated_at DESC)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_project
    ON sessions (project_session_id, lt_bucket)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_pinned
    ON sessions (pinned DESC, updated_at DESC)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_external
    ON sessions (external_trigger_id)`)

  db.run(`CREATE TABLE IF NOT EXISTS runs (
    id                    TEXT PRIMARY KEY NOT NULL,
    session_id            TEXT NOT NULL,
    request_id            TEXT NOT NULL,
    state                 TEXT NOT NULL DEFAULT 'accepted',
    tool                  TEXT NOT NULL,
    model                 TEXT NOT NULL,
    effort                TEXT,
    thinking              INTEGER DEFAULT 0,
    cancel_requested      INTEGER DEFAULT 0,
    result                TEXT,
    failure_reason        TEXT,
    runner_process_id     INTEGER,
    context_input_tokens  INTEGER,
    context_window_tokens INTEGER,
    created_at            TEXT NOT NULL,
    started_at            TEXT,
    updated_at            TEXT NOT NULL,
    completed_at          TEXT,
    finalized_at          TEXT
  ) STRICT`)

  db.run(`CREATE INDEX IF NOT EXISTS idx_runs_session
    ON runs (session_id, created_at DESC)`)

  db.run(`CREATE TABLE IF NOT EXISTS hooks (
    id                TEXT PRIMARY KEY NOT NULL,
    event_pattern     TEXT NOT NULL,
    label             TEXT NOT NULL,
    shell_command     TEXT NOT NULL,
    run_in_background INTEGER DEFAULT 0,
    enabled           INTEGER DEFAULT 1,
    created_at        TEXT NOT NULL
  ) STRICT`)

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY NOT NULL,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT`)
}

let _db: Database | null = null

export function getDb(): Database {
  if (_db) return _db

  const dbPath = resolveDbPath()
  mkdirSync(dirname(dbPath), { recursive: true })

  _db = new Database(dbPath, { create: true })
  initSchema(_db)

  return _db
}

export const db = getDb()
