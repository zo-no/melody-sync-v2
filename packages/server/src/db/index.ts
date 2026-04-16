import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function resolveDbPath(): string {
  const raw =
    process.env['MELODYSYNC_DB_PATH'] ??
    `${process.env['HOME'] ?? '~'}/.melodysync/runtime/sessions.db`

  return raw.startsWith('~/')
    ? resolve(process.env['HOME'] ?? '', raw.slice(2))
    : resolve(raw)
}

function hasColumn(db: Database, table: string, column: string): boolean {
  const rows = db.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all()
  return rows.some((row) => row.name === column)
}

function ensureColumn(db: Database, table: string, column: string, definition: string): void {
  if (hasColumn(db, table, column)) return
  db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

function initSchema(db: Database): void {
  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA foreign_keys = ON')

  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id            TEXT PRIMARY KEY NOT NULL,
    name          TEXT NOT NULL,
    path          TEXT NOT NULL,
    system_prompt TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  ) STRICT`)

  db.run(`CREATE INDEX IF NOT EXISTS idx_projects_updated
    ON projects (updated_at DESC)`)

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id                  TEXT PRIMARY KEY NOT NULL,
    project_id          TEXT NOT NULL REFERENCES projects(id),
    name                TEXT NOT NULL,
    auto_rename_pending INTEGER DEFAULT 0,
    tool                TEXT,
    model               TEXT,
    effort              TEXT,
    thinking            INTEGER DEFAULT 0,
    claude_session_id   TEXT,
    codex_thread_id     TEXT,
    active_run_id       TEXT,
    follow_up_queue     TEXT NOT NULL DEFAULT '[]',
    pinned              INTEGER DEFAULT 0,
    archived            INTEGER DEFAULT 0,
    archived_at         TEXT,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
  ) STRICT`)

  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_project
    ON sessions (project_id, pinned DESC, updated_at DESC)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_list
    ON sessions (archived, updated_at DESC)`)

  db.run(`CREATE TABLE IF NOT EXISTS runs (
    id                    TEXT PRIMARY KEY NOT NULL,
    session_id            TEXT NOT NULL REFERENCES sessions(id),
    request_id            TEXT NOT NULL,
    state                 TEXT NOT NULL DEFAULT 'accepted',
    tool                  TEXT NOT NULL DEFAULT 'codex',
    model                 TEXT NOT NULL,
    effort                TEXT,
    thinking              INTEGER DEFAULT 0,
    claude_session_id     TEXT,
    codex_thread_id       TEXT,
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

  db.run(`CREATE TABLE IF NOT EXISTS auth (
    id         TEXT PRIMARY KEY NOT NULL,
    kind       TEXT NOT NULL,
    value      TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT`)

  db.run(`CREATE TABLE IF NOT EXISTS auth_sessions (
    id         TEXT PRIMARY KEY NOT NULL,
    created_at TEXT NOT NULL,
    last_seen  TEXT NOT NULL,
    expires_at TEXT
  ) STRICT`)

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY NOT NULL,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT`)

  ensureColumn(db, 'sessions', 'tool', 'TEXT')
  ensureColumn(db, 'sessions', 'claude_session_id', 'TEXT')
  ensureColumn(db, 'sessions', 'codex_thread_id', 'TEXT')
  ensureColumn(db, 'runs', 'tool', "TEXT NOT NULL DEFAULT 'codex'")
  ensureColumn(db, 'runs', 'claude_session_id', 'TEXT')
  ensureColumn(db, 'runs', 'codex_thread_id', 'TEXT')
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

/** Override the db instance (for testing). Must be called before any model is used. */
export function setDb(instance: Database): void {
  _db = instance
}
