<!-- 实现指南：架构层映射、目录结构、启动顺序及 WebSocket 协议 -->

## 十一、架构层映射

```
packages/server/src/
│
├── db/
│   └── index.ts          SQLite 初始化（Bun 内置，WAL 模式，建表）
│
├── models/               纯数据操作层，无副作用，无 HTTP 依赖
│   ├── project.ts        Project CRUD + 内置项目初始化
│   ├── session.ts        Session CRUD
│   ├── session-event.ts  事件历史（SQLite + 文件外部化）
│   ├── run.ts            Session Run 状态机
│   ├── task.ts           Task CRUD + 状态流转 + callback 恢复
│   ├── task-log.ts       执行日志（保留最近 50 条）
│   ├── task-ops.ts       操作日志（永久保留）
│   ├── prompt.ts         提示词三层读写
│   └── context.ts        上下文组装（固有知识 + INDEX.md + 提示词三层）
│
├── services/             有状态服务层，server 启动时初始化
│   ├── scheduler.ts      调度器（croner + 内存 job registry + reconcile）
│   └── ws.ts             WebSocket invalidation 推送
│
├── controllers/
│   ├── http/             Hono 路由（解析请求 → 调用 model → 返回响应）
│   │   ├── projects.ts
│   │   ├── sessions.ts
│   │   ├── tasks.ts
│   │   ├── runs.ts
│   │   └── prompts.ts
│   └── cli/              Commander 命令（直接调用 model）
│       ├── project.ts
│       ├── session.ts
│       ├── task.ts
│       ├── run.ts
│       └── prompt.ts
│
├── server.ts             HTTP server 入口，启动顺序：
│                         1. initDb()
│                         2. reconcileTasks()（重置崩溃时的 running 任务）
│                         3. startScheduler()（注册所有 cron jobs）
│                         4. startServer(7761)
└── cli.ts                CLI 入口（bin: melodysync）

packages/web/src/
├── api/                  类型安全 HTTP client
├── controllers/          Zustand store
└── views/
    ├── pages/
    └── components/
```

### 调度器设计（services/scheduler.ts）

**方案：进程内 cron（croner 库）+ 启动时 reconcile**

```typescript
const jobRegistry = new Map<string, Cron>()  // taskId → cron job

export async function startScheduler(): Promise<void>  // server 启动时
export function registerTask(task: Task): void          // 任务创建/修改时
export function unregisterTask(taskId: string): void    // 任务删除时
export function stopScheduler(): void                   // server 关闭时
```

**reconcile 逻辑（启动时）：**
- 把所有 `status='running'` 的 AI 任务重置为 `pending`
- 写一条 `task_ops`：`op='status_changed', from='running', to='pending', note='server restart reconcile'`

**scheduled 任务错过处理：**
- `scheduledAt <= now` → 记录 `skipped`，不执行
- `scheduledAt > now` → 注册一次性定时器

**并发保护：**
- 触发前检查 `status='running'`
- 有 → 记录 `skipped`
- 无 → 更新 `status='running'`，执行，完成后更新状态

---

## 十二、WebSocket 协议

迁移 v1。WS 是纯 invalidation hint，不是数据源，HTTP 是 canonical。

**连接：** `ws://localhost:7761/ws`（需携带有效 Cookie）

**消息格式（服务端 → 客户端）：**

```typescript
interface WsMessage {
  type: 'session' | 'run' | 'task' | 'build'
  id: string        // 资源 id
  event: string     // 发生了什么
}
```

**事件表：**

| type | event | 触发时机 | 前端动作 |
|---|---|---|---|
| `session` | `updated` | 会话状态/名称变更 | 刷新会话列表 + 详情 |
| `run` | `started` | Run 开始执行 | 显示加载状态 |
| `run` | `delta` | AI 流式输出（每个 token） | 追加到聊天视图 |
| `run` | `done` | Run 完成 | 刷新事件历史 |
| `run` | `failed` | Run 失败 | 显示错误状态 |
| `task` | `updated` | 任务状态变更 | 刷新任务列表 |
| `task` | `created` | 新任务创建 | 刷新任务列表 |
| `build` | `updated` | 前端资源更新 | 提示用户刷新页面 |

**delta 消息携带额外字段：**

```typescript
interface RunDeltaMessage {
  type: 'run'
  event: 'delta'
  id: string        // runId
  sessionId: string
  delta: string     // 本次输出片段
}
```

**断线重连：**
- 前端检测到 WS 断开后自动重连
- 重连后通过 HTTP 拉取最新状态，不需要 WS 补推历史
