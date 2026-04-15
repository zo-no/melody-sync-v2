# 执行模型

## Session Run 执行流程

MelodySync 的执行模型专注于**会话执行**，任务执行由 conductor 负责。

### Run 生命周期

```
用户发送消息
  → 创建 Run（state='accepted'）
  → fork 子进程调用 AI provider（Claude CLI）
  → 流式输出写入 spool.jsonl
  → 主进程读取 spool，通过 WebSocket 推送 delta
  → 执行完成，finalize：spool 内容归一化写回 session_events
  → Run state='completed'
```

### Follow-up Queue

当 session 有正在执行的 run（activeRunId 存在）时，新消息进入 followUpQueue。

- 同一 requestId 不重复入队（去重）
- 当前 run 完成后，自动取出队列第一条消息执行
- 执行完继续检查队列，直到清空

### AI Provider 超时处理

- 执行超时：默认 300 秒
- 超时后：先发 SIGTERM，等 15 秒 grace period，再发 SIGKILL
- Run state='failed'，failureReason='timeout'

---

## conductor CLI 集成

MelodySync 后端通过 spawn conductor CLI 来读写任务数据。

### spawn 封装

```typescript
async function spawnConductor(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const proc = Bun.spawn(['conductor', ...args], { stdout: 'pipe', stderr: 'pipe' })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  await proc.exited
  return { stdout, stderr }
}
```

### 常用调用示例

```typescript
// 获取项目列表（供会话创建时选择归属项目）
const { stdout } = await spawnConductor(['project', 'list', '--json'])
const projects = JSON.parse(stdout)

// 获取某个项目的任务列表（供 Web UI 展示）
const { stdout } = await spawnConductor(['task', 'list', '--project', projectId, '--json'])
const tasks = JSON.parse(stdout)

// 创建任务（AI 在会话中通过 CLI 调用，不走 MelodySync 后端）
// AI 直接在 session 里执行：conductor task create ...
```

### AI 在会话中操作任务

AI 在会话中直接调用 conductor CLI，不经过 MelodySync 后端：

```
用户：帮我每天早上 9 点生成一份工作摘要
AI：好的，我来创建一个周期任务。
    [执行] conductor task create --title "每日工作摘要" --project <id> \
           --assignee ai --kind recurring --cron "0 9 * * *" \
           --executor-kind ai_prompt --prompt "生成今日工作摘要"
    任务已创建，明天早上 9 点开始执行。
```

---

## Runtime Selection 持久化

用户选择的 tool/model/effort/thinking 在会话间保持。

```typescript
interface RuntimeSelection {
  tool?: string
  model?: string
  effort?: string
  thinking?: boolean
}
```

- 存储：settings 表，key='runtime_selection'
- 读取时机：新建会话时作为默认值
- 写入时机：用户在 UI 修改后持久化
