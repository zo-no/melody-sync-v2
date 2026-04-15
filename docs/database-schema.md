<!-- 数据库 Schema：所有 SQLite 表定义及运行时数据存储说明 -->

## 十、数据库 Schema（SQLite）

### projects 表

```sql
CREATE TABLE projects (
  id          TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL,
  memory_path TEXT,
  parent_id   TEXT REFERENCES projects(id),
  is_builtin  INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
) STRICT;
```

### sessions 表

```sql
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY NOT NULL,
  project_id    TEXT NOT NULL REFERENCES projects(id),
  name          TEXT NOT NULL,
  tool          TEXT,
  model         TEXT,
  effort        TEXT,
  thinking      INTEGER DEFAULT 0,
  system_prompt TEXT,
  active_run_id TEXT,
  pinned        INTEGER DEFAULT 0,
  archived      INTEGER DEFAULT 0,
  archived_at   TEXT,
  folder        TEXT NOT NULL DEFAULT '~',
  data          TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
) STRICT;

CREATE INDEX idx_sessions_project ON sessions(project_id, updated_at DESC);
CREATE INDEX idx_sessions_pinned  ON sessions(pinned DESC, updated_at DESC);
```

### tasks 表

```sql
CREATE TABLE tasks (
  id                   TEXT PRIMARY KEY NOT NULL,
  project_id           TEXT NOT NULL REFERENCES projects(id),
  title                TEXT NOT NULL,
  description          TEXT,

  -- 谁执行（正交于 kind）
  -- 'ai' | 'human'
  assignee             TEXT NOT NULL DEFAULT 'ai',

  -- 触发方式（正交于 assignee）
  -- 'once' | 'scheduled' | 'recurring'
  kind                 TEXT NOT NULL,

  -- 人类任务：'pending' | 'done' | 'cancelled'
  -- AI 任务：'pending' | 'running' | 'done' | 'failed' | 'cancelled' | 'blocked'
  status               TEXT NOT NULL DEFAULT 'pending',

  -- AI 任务专用
  executor_kind        TEXT,                        -- 'script' | 'ai_prompt' | 'http'
  executor_config      TEXT,                        -- JSON
  executor_options     TEXT,                        -- JSON
  schedule_config      TEXT,                        -- JSON（cron / scheduledAt）
  completion_output    TEXT,                        -- 人类完成后填写，恢复时注入

  -- 人类任务专用
  waiting_instructions TEXT,                        -- AI 写给人类的说明
  source_task_id       TEXT REFERENCES tasks(id),   -- 来自哪个 AI 任务
  blocked_by_task_id   TEXT REFERENCES tasks(id),   -- 哪个人类任务阻塞了我

  enabled              INTEGER NOT NULL DEFAULT 1,   -- 0=暂停，调度器跳过

  created_by           TEXT NOT NULL DEFAULT 'human',
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
) STRICT;

CREATE INDEX idx_tasks_project  ON tasks(project_id, status, updated_at DESC);
CREATE INDEX idx_tasks_assignee ON tasks(assignee, kind, status);
CREATE INDEX idx_tasks_source   ON tasks(source_task_id);
CREATE INDEX idx_tasks_blocked  ON tasks(blocked_by_task_id);
```

### task_logs 表（执行日志）

记录每次任务执行的结果，任务删除时**级联删除**。

```sql
CREATE TABLE task_logs (
  id           TEXT PRIMARY KEY NOT NULL,
  task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status       TEXT NOT NULL,   -- 'success' | 'failed' | 'cancelled' | 'skipped'
  triggered_by TEXT NOT NULL,   -- 'manual' | 'scheduler' | 'api' | 'cli'
  output       TEXT,            -- stdout + stderr，截断至 64KB
  error        TEXT,
  skip_reason  TEXT,            -- status=skipped 时的原因
  started_at   TEXT NOT NULL,
  completed_at TEXT
) STRICT;

CREATE INDEX idx_task_logs_task ON task_logs(task_id, started_at DESC);
```

保留策略：每个任务最近 50 条，超出后删除最旧的。

---

### task_ops 表（操作日志）

记录任务的状态变更和关键操作，**永久保留**，任务删除时不级联删除（保留历史）。

```sql
CREATE TABLE task_ops (
  id          TEXT PRIMARY KEY NOT NULL,
  task_id     TEXT NOT NULL,   -- 不加 REFERENCES，任务删除后仍保留
  op          TEXT NOT NULL,   -- 见下方 op 枚举
  from_status TEXT,            -- 变更前状态（status_changed 时有效）
  to_status   TEXT,            -- 变更后状态（status_changed 时有效）
  actor       TEXT NOT NULL,   -- 'human' | 'ai' | 'scheduler'
  note        TEXT,            -- 附加说明（如 completion_output、skip_reason）
  created_at  TEXT NOT NULL
) STRICT;

CREATE INDEX idx_task_ops_task    ON task_ops(task_id, created_at DESC);
CREATE INDEX idx_task_ops_created ON task_ops(created_at DESC);
```

**op 枚举：**

| op | 触发时机 |
|---|---|
| `created` | 任务创建时 |
| `triggered` | 手动触发执行时 |
| `status_changed` | 状态发生变更时（pending→running、running→done 等） |
| `done` | 人类任务被标记完成时 |
| `cancelled` | 任务被取消时 |
| `deleted` | 任务被删除时（此后 task_id 对应的 tasks 行不存在） |

**CLI 查询：**

```bash
melodysync task ops <id> [--limit 20] [--json]
```

### session_events 表

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

### system_prompts 表

```sql
CREATE TABLE system_prompts (
  key        TEXT PRIMARY KEY NOT NULL,  -- 'default' | 'proj_<id>'
  content    TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
```

### auth 表（认证凭据）

迁移自 v1 的 `auth.json` + `tools.json`（token 部分）。

```sql
CREATE TABLE auth (
  id         TEXT PRIMARY KEY NOT NULL,  -- 'password' | 'token_<hex>'
  kind       TEXT NOT NULL,              -- 'password' | 'token'
  value      TEXT NOT NULL,              -- bcrypt hash（password）| token 明文（token）
  created_at TEXT NOT NULL
) STRICT;
```

### auth_sessions 表（登录会话）

迁移自 v1 的 `auth-sessions.json`。

```sql
CREATE TABLE auth_sessions (
  id         TEXT PRIMARY KEY NOT NULL,  -- session token（随机 hex，存入 Cookie）
  created_at TEXT NOT NULL,
  last_seen  TEXT NOT NULL,
  expires_at TEXT                        -- null = 永不过期（v1 行为）
) STRICT;
```

**认证流程（迁移 v1）：**

```
POST /auth/login { password } 或 { token }
  → 验证成功（bcrypt 比对 password，或明文比对 token）
  → 创建 auth_sessions 记录
  → 返回 Set-Cookie: ms_session=<id>; HttpOnly; Path=/

每次 HTTP 请求
  → 读 Cookie ms_session
  → 查 auth_sessions，记录存在则通过
  → 不存在或过期 → 401

CLI 命令
  → 直接操作本地 SQLite，不需要认证
```

### runs 表（Session Run）

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

Session Run 的 spool 和 artifacts 仍存文件系统：
`~/.melodysync/runtime/runs/<runId>/spool.jsonl`
`~/.melodysync/runtime/runs/<runId>/artifacts/`
