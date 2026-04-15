# CLI & HTTP API

> MelodySync 的 CLI 和 HTTP API 只涉及会话相关操作。
> 任务和项目操作通过 `conductor` CLI 完成。

---

## CLI 命令（melodysync）

### 会话操作

```bash
melodysync session list [--project <conductor-project-id>] [--json]
melodysync session get <id> [--json]
melodysync session create [--name "..."] [--project <id>] [--tool "..."] [--model "..."] [--json]
melodysync session send <id> <text> [--json]
melodysync session update <id> [--name "..."] [--model "..."] [--tool "..."] [--project <id>] [--json]
melodysync session archive <id> [--json]
melodysync session delete <id> [--json]
```

### Run 操作

```bash
melodysync run get <id> [--json]
melodysync run list <session-id> [--json]
melodysync run cancel <id> [--json]
```

### 系统操作

```bash
melodysync storage-maintenance [--apply] [--json]   # 清理 spool/logs，默认 dry-run
melodysync version
melodysync info [--json]
```

---

## HTTP API

### Sessions

```
GET    /api/sessions              列出会话（支持 ?projectId=）
POST   /api/sessions              创建会话
GET    /api/sessions/:id          获取会话详情
PATCH  /api/sessions/:id          更新会话
DELETE /api/sessions/:id          删除会话
POST   /api/sessions/:id/messages 发送消息
GET    /api/sessions/:id/events   获取事件历史
GET    /api/sessions/:id/runs     获取该会话的执行历史
```

说明：
- `Session.projectId` 引用 conductor 的 project id
- `PATCH /api/sessions/:id` 支持修改 `projectId`（迁移会话到其他项目）
- `POST /api/sessions/:id/messages` 默认使用 Session 上保存的 tool/model/effort/thinking
- 忙时新消息进入 follow-up queue

### Runs

```
GET    /api/runs/:id              获取单个 run
POST   /api/runs/:id/cancel       取消执行中的 run
```

### Tasks（代理 conductor CLI）

```
GET    /api/tasks                 列出任务（spawn conductor task list --json）
POST   /api/tasks                 创建任务（spawn conductor task create ...）
GET    /api/tasks/:id             获取任务（spawn conductor task get <id> --json）
PATCH  /api/tasks/:id             更新任务（spawn conductor task update ...）
DELETE /api/tasks/:id             删除任务（spawn conductor task delete ...）
POST   /api/tasks/:id/run         手动触发（spawn conductor task run ...）
POST   /api/tasks/:id/done        标记完成（spawn conductor task done ...）
POST   /api/tasks/:id/cancel      取消（spawn conductor task cancel ...）
GET    /api/tasks/:id/logs        执行日志（spawn conductor task logs ...）
GET    /api/tasks/:id/ops         操作日志（spawn conductor task ops ...）
```

### Projects（代理 conductor CLI）

```
GET    /api/projects              列出项目（spawn conductor project list --json）
POST   /api/projects              创建项目（spawn conductor project create ...）
GET    /api/projects/:id          获取项目（spawn conductor project get <id> --json）
PATCH  /api/projects/:id          更新项目（spawn conductor project update ...）
DELETE /api/projects/:id          删除项目（spawn conductor project delete ...）
```

### Auth

```
POST   /auth/login                登录（body: { password } 或 { token }）
POST   /auth/logout               登出
GET    /api/auth/me               当前登录状态
```

### System

```
GET    /api/tools                 工具列表
GET    /api/models                模型列表
```
