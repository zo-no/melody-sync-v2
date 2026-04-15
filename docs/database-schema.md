# 数据库 Schema（SQLite）

MelodySync v2 只维护会话相关数据。任务和项目数据存储在 conductor 的数据库（`~/.conductor/db.sqlite`）。

MelodySync 数据库位置：`~/.melodysync/runtime/sessions.db`

---

## sessions 表

```sql
CREATE TABLE sessions (
  id                  TEXT PRIMARY KEY NOT NULL,
  project_id          TEXT NOT NULL,   -- conductor project id，不做外键约束
  name                TEXT NOT NULL,
  auto_rename_pending INTEGER DEFAULT 0,
  tool                TEXT,
  model               TEXT,
  effort              TEXT,
  thinking            INTEGER DEFAULT 0,
  active_run_id       TEXT,
  pinned              INTEGER DEFAULT 0,
  archived            INTEGER DEFAULT 0,
  archived_at         TEXT,
  data                TEXT NOT NULL DEFAULT '{}',  -- 兼容迁移期附加字段
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
) STRICT;

CREATE INDEX idx_sessions_project ON sessions(project_id, updated_at DESC);
CREATE INDEX idx_sessions_pinned  ON sessions(pinned DESC, updated_at DESC);
```

---

## session_events 表

```sql
CREATE TABLE session_events (
  id           TEXT PRIMARY KEY NOT NULL,
  session_id   TEXT NOT NULL REFERENCES sessions(id),
  seq          INTEGER NOT NULL,
  type         TEXT NOT NULL,
  role         TEXT,
  content      TEXT,
  body_ref     TEXT,
  body_bytes   INTEGER,
  body_preview TEXT,
  timestamp    INTEGER NOT NULL,
  created_at   TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX idx_session_events_seq     ON session_events(session_id, seq);
CREATE INDEX        idx_session_events_session ON session_events(session_id, timestamp DESC);
```

大 body 外部化规则：

| 事件类型 | inline 上限 |
|---|---|
| message | 64KB |
| reasoning | 始终外部化 |
| tool_use | 2KB |
| tool_result | 4KB |

外部化路径：`~/.melodysync/runtime/sessions/history/<sessionId>/bodies/<ref>.txt`

---

## runs 表

```sql
CREATE TABLE runs (
  id                    TEXT PRIMARY KEY NOT NULL,
  session_id            TEXT NOT NULL REFERENCES sessions(id),
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
) STRICT;

CREATE INDEX idx_runs_session ON runs(session_id, created_at DESC);
```

---

## auth 表

```sql
CREATE TABLE auth (
  id         TEXT PRIMARY KEY NOT NULL,  -- 'password' | 'token_<hex>'
  kind       TEXT NOT NULL,              -- 'password' | 'token'
  value      TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;
```

## auth_sessions 表

```sql
CREATE TABLE auth_sessions (
  id         TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  last_seen  TEXT NOT NULL,
  expires_at TEXT                        -- null = 永不过期
) STRICT;
```

## settings 表

```sql
CREATE TABLE settings (
  key        TEXT PRIMARY KEY NOT NULL,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
```
