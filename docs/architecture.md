# MelodySync v2 架构概览

## 产品定位

MelodySync v2 是一个**远程 AI 会话工具**，核心职责：

1. **会话管理**：维护与 AI 的对话记录（Session / Run）
2. **任务可视化**：通过后端 spawn conductor CLI 展示和操作任务

任务调度能力由 **[conductor](https://github.com/xiaokeqiang/conductor)** 提供，MelodySync 不自己实现任务系统。

## 系统边界

```
conductor（独立工具）
  ├── Project + Task 管理
  ├── 调度器（recurring / scheduled / once）
  ├── 执行器（ai_prompt / script / http）
  ├── TaskLog + TaskOps
  └── CLI（conductor task / project / prompt）

MelodySync v2（本项目）
  ├── Session（AI 对话会话）
  ├── Run（单次执行快照）
  ├── Auth（认证）
  ├── WebSocket（实时推送）
  └── Web UI
      ├── 会话视图（自己的 HTTP API）
      └── 任务视图（后端 spawn conductor CLI 获取数据）
```

## 与 conductor 的集成方式

MelodySync **后端** spawn conductor CLI 来读写任务数据：

```typescript
// 示例：获取任务列表
const result = await spawnCli('conductor', ['task', 'list', '--json'])
const tasks = JSON.parse(result.stdout)

// 示例：创建任务
await spawnCli('conductor', ['task', 'create', '--title', '...', '--project', id, '--json'])
```

前端只和 MelodySync 自己的 HTTP API 通信，不直接调用 conductor。

## 顶层数据模型

```
Session（会话）
  ├── id, projectId（来自 conductor 的 project id）
  ├── 对话历史（session_events）
  └── Run[]（执行快照）
```

注意：Session 的 `projectId` 引用的是 conductor 里的 Project id，但 MelodySync 自己的数据库不存 Project 数据，按需通过 CLI 查询。

## 文档导航

- 数据模型 → [data-model.md](data-model.md)
- 执行模型 → [execution-model.md](execution-model.md)
- 数据库 Schema → [database-schema.md](database-schema.md)
- 架构实现 → [implementation-guide.md](implementation-guide.md)
- CLI & HTTP API → [cli-api.md](cli-api.md)
- Web UI 设计 → [ui-design.md](ui-design.md)
- 已决策项 → [decisions.md](decisions.md)
- 一期范围 → [roadmap.md](roadmap.md)
