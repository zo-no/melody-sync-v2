# 数据模型

MelodySync v2 只维护会话相关数据。任务和项目数据由 conductor 管理。

---

## Session（会话）

会话是**持久对话容器**，归属于某个 conductor Project。

```typescript
interface Session {
  id: string              // 'sess_' + hex
  projectId: string       // conductor project id；创建时可省略，默认 conductor 的默认项目

  createdAt: string
  updatedAt: string

  name: string
  autoRenamePending?: boolean

  tool?: string
  model?: string
  effort?: string
  thinking?: boolean

  activeRunId?: string

  pinned?: boolean
  archived?: boolean
  archivedAt?: string
}
```

**Session 的职责：**
- 持有会话身份和项目归属
- 持有会话级默认运行偏好（tool / model / effort / thinking）
- 指向当前活跃执行（activeRunId）
- 作为会话历史的宿主对象

**Session 不负责：**
- 不管理任务（任务由 conductor 管理）
- 不承载 prompt 分层
- 不公开承载 follow-up queue 明细

---

## Run（会话执行）

`Run` 是某个 `Session` 下的一次**具体执行尝试**，复用 v1 detached run 语义。

```typescript
interface Run {
  id: string              // 'run_' + hex
  sessionId: string
  requestId: string

  state: RunState

  tool: string
  model: string
  effort?: string
  thinking: boolean

  cancelRequested: boolean

  result?: RunResult
  failureReason?: string
  runnerProcessId?: number

  createdAt: string
  startedAt?: string
  updatedAt: string
  completedAt?: string
  finalizedAt?: string
}

type RunState = 'accepted' | 'running' | 'completed' | 'failed' | 'cancelled'
type RunResult = 'success' | 'error' | 'cancelled'
```

**Session / Run 边界：**
- Session 保存默认运行偏好和会话身份
- Run 保存某次执行的快照和生命周期
- Run 完成后，其可见输出归一化写回 session_events
- session_events 是 canonical truth
