# AGENTS.md — MelodySync v2 项目上下文

> 这是 AI 协作说明文件。开始任何工作前先读完这个文件。

---

## 这个项目是什么

MelodySync v2 是一个**本地优先的 AI 任务工作台**，单用户。

核心对象：
- **Project**（项目）— 组织维度，会话和任务都归属于项目
- **Session**（会话）— 纯对话记录，用于人与 AI 交流
- **Task**（任务）— 独立可执行单元，与会话完全解耦

AI 通过 CLI 操作任务，人类通过 Web UI 查看和管理。

---

## 如何读这个项目

### 第一步：读架构文档

```
docs/README.md         ← 文档导航入口，从这里开始
docs/architecture.md   ← 产品定位 + 顶层数据模型（概览）
```

按需深入阅读：
- [数据模型](docs/data-model.md) — Project / Session / Task 数据结构
- [记忆系统](docs/memory-system.md) — INDEX.md 约定、知识库注入
- [执行模型](docs/execution-model.md) — 提示词三层、调度器、任务执行流程
- [数据库 Schema](docs/database-schema.md) — SQLite 表定义
- [架构实现](docs/implementation-guide.md) — 目录结构、启动顺序、WebSocket
- [CLI & HTTP API](docs/cli-api.md) — 所有接口定义
- [Web UI 设计](docs/ui-design.md) — 布局、交互、组件
- [已决策项](docs/decisions.md) — 所有设计决策汇总
- [一期范围](docs/roadmap.md) — 当前开发目标

### 第二步：了解目录结构

```
melody-sync-v2/
├── packages/
│   ├── server/          # 后端（Bun + Hono + TypeScript）
│   │   └── src/
│   │       ├── db/           # SQLite 初始化（建表）
│   │       ├── models/       # M — 纯数据操作层（无副作用，无 HTTP 依赖）
│   │       ├── services/     # 有状态服务层（调度器、WS 推送）
│   │       │   ├── scheduler.ts  # croner + job registry + reconcile
│   │       │   └── ws.ts         # WebSocket invalidation
│   │       ├── controllers/
│   │       │   ├── http/     # C — Hono 路由层
│   │       │   └── cli/      # C — Commander CLI 层
│   │       ├── server.ts     # HTTP server 入口（port 7761）
│   │       │                 # 启动顺序：initDb → reconcile → scheduler → HTTP
│   │       └── cli.ts        # CLI 入口（bin: melodysync）
│   │
│   ├── web/             # 前端（React 19 + Vite + Zustand + TailwindCSS）
│   │   └── src/
│   │       ├── api/          # 类型安全 HTTP client
│   │       ├── controllers/  # Zustand store
│   │       └── views/        # 页面和组件
│   │
│   └── types/           # 共享类型（前后端共用）
│       └── src/
│           ├── session.ts
│           ├── run.ts
│           ├── workbench.ts
│           └── api.ts
│
├── docs/
│   └── architecture.md  # 权威架构文档
├── AGENTS.md            # 本文件
└── pnpm-workspace.yaml
```

### 第三步：理解 MVC 架构

```
Model（packages/server/src/models/）
  不依赖 HTTP，直接操作 SQLite 和文件系统
  CLI 和 HTTP routes 都调用这层

Controller — HTTP（packages/server/src/controllers/http/）
  Hono 路由，只做：解析请求 → 调用 Model → 返回响应

Controller — CLI（packages/server/src/controllers/cli/）
  Commander 命令，直接调用 Model，不走 HTTP

View（packages/web/src/）
  React 组件，通过 api/ 消费 HTTP API
```

---

## 快速定位

| 要改什么 | 先看文档 | 再看代码 |
|---|---|---|
| 数据结构 | `docs/data-model.md` | `packages/server/src/db/` + `packages/types/src/` |
| 记忆系统 | `docs/memory-system.md` | `packages/server/src/models/context.ts` |
| 任务执行流程 | `docs/execution-model.md` | `packages/server/src/models/task.ts` |
| 调度器 | `docs/execution-model.md` | `packages/server/src/services/scheduler.ts` |
| WebSocket | `docs/implementation-guide.md` | `packages/server/src/services/ws.ts` |
| CLI 命令 | `docs/cli-api.md` | `packages/server/src/controllers/cli/` |
| HTTP 路由 | `docs/cli-api.md` | `packages/server/src/controllers/http/` |
| Session / Run | `docs/data-model.md` | `packages/server/src/models/session.ts` + `run.ts` |
| 前端布局 | `docs/ui-design.md` | `packages/web/src/views/` |
| 前端状态 | `docs/ui-design.md` | `packages/web/src/controllers/` |
| 已决策项 | `docs/decisions.md` | — |
| 一期进度 | `docs/roadmap.md` | — |

---

## 开发规范

1. **Model 层无 HTTP 依赖**：model 函数只接受普通参数，不接触 req/res
2. **CLI 和 HTTP 共用 Model**：不要在 controller 里写业务逻辑
3. **类型从 @melody-sync/types 引入**：不要在 server 或 web 里重复定义共享类型
4. **所有 CLI 命令支持 --json**：AI 调用时解析 JSON 输出
5. **SQLite 用 Bun 内置**：不用 better-sqlite3 或 drizzle
6. **任务操作写 task_ops**：每次状态变更都要记录操作日志
7. **prompt 占位符**：context.ts 组装时支持 `{memoryPath}`、`{date}`（YYYY-MM-DD）、`{projectName}` 等占位符，用 replaceAll 替换，执行时动态注入
8. **查询任务历史**：`melodysync task ops <id>` 查操作日志，`melodysync task logs <id>` 查执行日志，AI 做系统分析时可以读取这些数据

---

## 当前开发状态

一期范围见 `docs/architecture.md` 十五章节。

参考项目：`/Users/kual/code/melody-sync`（v1，可以参考迁移实现）
