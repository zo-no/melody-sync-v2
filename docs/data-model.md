<!-- 数据结构详情：Project / Session / Task 及所有子类型、TaskLog 的完整 TypeScript 接口定义 -->

## 三、核心数据结构

### 3.1 Project（项目）

```typescript
interface Project {
  id: string              // 'proj_' + hex，不可变
  createdAt: string
  updatedAt: string

  name: string

  // 项目文件夹（可选）
  // AI 执行任务时知道这个路径，可以读写里面的文件
  // 每个 memoryPath 下约定 INDEX.md 作为 agent 必读的知识库入口
  memoryPath?: string

  parentId?: string       // null = 顶层项目，最多 2 层
  isBuiltin: boolean      // true = 系统内置，不可删除

  archived: boolean
  archivedAt?: string
}
```

---

### 3.2 Session（会话）

会话是**纯对话记录**，不承载任务语义。

```typescript
interface Session {
  id: string              // 'sess_' + hex
  createdAt: string
  updatedAt: string

  projectId: string       // 所属项目，默认 proj_daily

  name: string
  autoRenamePending?: boolean

  tool?: string
  model?: string
  effort?: string
  thinking?: boolean
  systemPrompt?: string

  activeRunId?: string
  followUpQueue?: FollowUpEntry[]

  pinned?: boolean
  archived?: boolean
  archivedAt?: string
  folder?: string         // 侧边栏分组，默认 '~'
}
```

**会话与任务的关系：**
- 会话不直接引用任务
- 用户在会话中用自然语言描述需求，AI 理解后通过 CLI/API 操作任务
- 任务面板 UI 与会话 UI 完全独立

---

### 3.3 Task（任务）

`assignee` 和 `kind` 正交设计，两个字段独立：
- `assignee` 决定**谁执行**
- `kind` 决定**怎么触发**

合法组合示例：

| assignee | kind | 场景 |
|---|---|---|
| human | once | 临时待办、AI 创建的卡点任务 |
| human | scheduled | 定时提醒（明天下午3点开会） |
| human | recurring | 周期打卡（每天喝水、每周复盘） |
| ai | once | 手动触发的 AI 任务 |
| ai | scheduled | 定时执行的 AI 任务 |
| ai | recurring | 周期执行的 AI 任务（每日晨报） |

```typescript
interface Task {
  id: string              // 'task_' + hex
  createdAt: string
  updatedAt: string

  projectId: string

  title: string
  description?: string

  // 谁执行（正交于 kind）
  assignee: 'ai' | 'human'

  // 触发方式（正交于 assignee）
  kind: TaskKind

  status: TaskStatus

  // 调度配置（kind=scheduled/recurring 时有效）
  scheduleConfig?: ScheduleConfig

  // 执行器（assignee=ai 时有效）
  executor?: TaskExecutor
  executorOptions?: ExecutorOptions

  // 人类任务字段（assignee=human 时有效）
  waitingInstructions?: string  // AI 写给人类的完成说明
  sourceTaskId?: string         // 来自哪个 AI 任务（卡点场景）
  blockedByTaskId?: string      // 哪个 AI 任务在等它完成

  // AI 任务恢复字段
  completionOutput?: string     // 人类完成后填写，恢复时注入上下文

  enabled: boolean      // 是否启用，默认 true；false 时调度器跳过，不触发执行

  createdBy: 'human' | 'ai'
}
```

#### TaskKind

```typescript
type TaskKind =
  | 'once'       // 一次性，手动触发
  | 'scheduled'  // 定时，一次性
  | 'recurring'  // 周期，反复执行
```

#### TaskStatus

```typescript
// 人类任务（assignee=human）
type HumanTaskStatus =
  | 'pending'    // 待处理
  | 'done'       // 已完成（checkbox 勾选）
  | 'cancelled'  // 已取消

// AI 任务（assignee=ai）
type AiTaskStatus =
  | 'pending'    // 待执行
  | 'running'    // 执行中
  | 'done'       // 已完成
  | 'failed'     // 执行失败
  | 'cancelled'  // 已取消
  | 'blocked'    // 被人类任务阻塞（等待人类完成）

type TaskStatus = HumanTaskStatus | AiTaskStatus
```

#### 任务状态转移

**AI 任务（assignee=ai）：**
```
pending → running    （调度器触发 / 手动 task run）
running → done       （执行成功）
running → failed     （执行失败）
running → cancelled  （用户取消）
pending → cancelled  （用户取消）
failed  → pending    （手动 task run 重试）
cancelled → pending  （手动 task run 重试）
pending → blocked    （创建了等待任务，AI 自己阻塞自己）
blocked → pending    （等待任务完成或取消，自动解除）
```

**人类任务（assignee=human）：**
```
pending → done       （checkbox 勾选 / melodysync task done）
pending → cancelled  （melodysync task cancel）
```

**不合法的转移（系统拒绝）：**
- done → 任何状态（已完成不可逆）
- blocked → cancelled（必须先解除阻塞）

#### ScheduleConfig

```typescript
interface ScheduledConfig {
  kind: 'scheduled'
  scheduledAt: string
}

interface RecurringConfig {
  kind: 'recurring'
  cron: string
  timezone?: string
  lastRunAt?: string
  nextRunAt?: string
}
```

#### TaskExecutor

```typescript
interface ScriptExecutor {
  kind: 'script'
  command: string
  workDir?: string        // 默认 project.memoryPath
  env?: Record<string, string>
  timeout?: number        // 秒，默认 300
}

interface AiPromptExecutor {
  kind: 'ai_prompt'
  prompt: string          // 任务级 prompt
  tool?: string
  model?: string
}

interface HttpExecutor {
  kind: 'http'
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: string
  timeout?: number
}
```

#### ExecutorOptions

```typescript
interface ExecutorOptions {
  includeLastLog?: boolean    // 是否注入上次执行结果，默认 false
  reviewOnComplete?: boolean  // 执行完是否创建人类 review 任务，默认 false
}
```

---

### 3.4 TaskLog（执行日志）

```typescript
interface TaskLog {
  id: string
  taskId: string
  startedAt: string
  completedAt?: string
  status: 'success' | 'failed' | 'cancelled' | 'skipped'
  output?: string           // stdout + stderr，截断至 64KB
  error?: string
  triggeredBy: 'manual' | 'scheduler' | 'api' | 'cli'
  skipReason?: string
}
```

保留策略：每个任务最近 50 条。
