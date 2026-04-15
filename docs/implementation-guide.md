# 架构层映射

## 目录结构

```
packages/server/src/
│
├── db/
│   └── index.ts          SQLite 初始化（Bun 内置，WAL 模式，建表）
│
├── models/               纯数据操作层，无副作用，无 HTTP 依赖
│   ├── session.ts        Session CRUD
│   ├── session-event.ts  事件历史（SQLite + 文件外部化）
│   └── run.ts            Session Run 状态机
│
├── services/
│   ├── conductor.ts      conductor CLI spawn 封装
│   └── ws.ts             WebSocket invalidation 推送
│
├── controllers/
│   ├── http/             Hono 路由（解析请求 → 调用 model/conductor → 返回响应）
│   │   ├── sessions.ts
│   │   ├── runs.ts
│   │   ├── tasks.ts      代理 conductor CLI
│   │   └── projects.ts   代理 conductor CLI
│   └── cli/              Commander 命令（直接调用 model）
│       ├── session.ts
│       └── run.ts
│
├── server.ts             HTTP server 入口，启动顺序：
│                         1. initDb()
│                         2. startServer(7761)
└── cli.ts                CLI 入口（bin: melodysync）

packages/web/src/
├── api/                  类型安全 HTTP client
├── controllers/          Zustand store
└── views/
    ├── pages/
    └── components/
```

## conductor 集成层（services/conductor.ts）

```typescript
import { $ } from 'bun'

export async function conductorCli(args: string[]): Promise<unknown> {
  const result = await $`conductor ${args} --json`.quiet()
  return JSON.parse(result.stdout.toString())
}

// 示例用法
export const conductor = {
  project: {
    list: () => conductorCli(['project', 'list']),
    get: (id: string) => conductorCli(['project', 'get', id]),
  },
  task: {
    list: (opts: { projectId?: string; status?: string }) =>
      conductorCli(['task', 'list', ...(opts.projectId ? ['--project', opts.projectId] : [])]),
    get: (id: string) => conductorCli(['task', 'get', id]),
    run: (id: string) => conductorCli(['task', 'run', id]),
    done: (id: string, output?: string) =>
      conductorCli(['task', 'done', id, ...(output ? ['--output', output] : [])]),
    cancel: (id: string) => conductorCli(['task', 'cancel', id]),
    logs: (id: string) => conductorCli(['task', 'logs', id]),
    ops: (id: string) => conductorCli(['task', 'ops', id]),
  },
}
```

## WebSocket 协议

WS 是纯 invalidation hint，HTTP 是 canonical。

**连接：** `ws://localhost:7761/ws`（需携带有效 Cookie）

**消息格式（服务端 → 客户端）：**

```typescript
interface WsMessage {
  type: 'session' | 'run' | 'task' | 'build'
  id: string
  event: string
}
```

**事件表：**

| type | event | 触发时机 | 前端动作 |
|---|---|---|---|
| `session` | `updated` | 会话状态/名称变更 | 刷新会话列表 + 详情 |
| `run` | `started` | Run 开始执行 | 显示加载状态 |
| `run` | `delta` | AI 流式输出 | 追加到聊天视图 |
| `run` | `done` | Run 完成 | 刷新事件历史 |
| `run` | `failed` | Run 失败 | 显示错误状态 |
| `task` | `updated` | 任务状态变更（conductor 推送） | 刷新任务列表 |
| `build` | `updated` | 前端资源更新 | 提示用户刷新页面 |

**task 事件来源：**
conductor 本身不推送 WebSocket，MelodySync 后端可以定期 poll conductor CLI 或监听 conductor 的 HTTP API 来获取任务变更，再通过自己的 WS 推送给前端。一期可以简化为前端定时轮询 `/api/tasks`。
