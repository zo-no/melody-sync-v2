<!-- 执行模型：提示词三层架构、ai_prompt 完整上下文、调度器设计、任务执行完成流程、等待任务 Callback 流转 -->

## 五、提示词三层架构

`ai_prompt` executor 执行时，提示词按以下顺序组装：

```
系统级 prompt（system_prompts 表，key='default'）
  ↓ 追加
项目级 prompt（system_prompts 表，key='proj_<id>'）
  ↓ 追加
任务级 prompt（task.executor.prompt）
```

用户通过 Web UI 或 CLI 编辑各层提示词：

```bash
melodysync prompt get [--project <id>]
melodysync prompt set "<content>" [--project <id>]
```

---

## 六、ai_prompt 执行时的完整上下文

```
[1] 固有知识（所有项目列表 + 路径）
[2] 全局 INDEX.md 内容（如果存在）
[3] 当前项目 INDEX.md 内容（如果存在）
[4] 系统级 prompt
[5] 项目级 prompt（如有）
[6] 任务级 prompt
[7] 上次执行结果（仅当 includeLastLog=true）
[8] blocked 恢复注入（completionOutput，仅从 blocked 状态恢复时）
```

**INDEX.md 中关于日志查询的说明（系统写入）：**

AI 可通过以下 CLI 命令查看任务历史，用于后续迭代和分析：
```
melodysync task ops <task_id>   任务操作记录（永久保留，包括已删除任务）
melodysync task logs <task_id>  任务执行结果日志（最近50条）
```

---

## 七、调度器设计

- `scheduled`：到达 `scheduledAt` 时触发一次，执行后 status='done'
- `recurring`：按 cron 触发，执行完更新 `lastRunAt/nextRunAt`，status 保持 'pending'
- **错过处理**：不补跑，记录 `skipped` 日志，下次 cron 正常触发
- **重启后**：不回头触发，下次 cron 时间正常触发
- **并发保护**：同一任务上次还在 running，跳过本次，记录 `skipped`

**scheduled 任务创建校验：**
- 创建时如果 `scheduledAt < now`，返回错误，不允许创建
- CLI 提示：`错误：scheduledAt 不能是过去的时间`
- HTTP API 返回 400：`{ ok: false, error: "scheduledAt must be in the future" }`

---

## 八、任务执行完成流程

### AI 任务执行完（reviewOnComplete=false）

```
AI 任务执行完
  → status='done'
  → 写 task_logs（output、duration、status）
  → 写 task_ops（op='status_changed', from='running', to='done'）
```

### AI 任务执行完（reviewOnComplete=true）

```
AI 任务执行完
  → status='done'
  → 写 task_logs
  → 写 task_ops（op='status_changed', from='running', to='done'）
  → AI 创建 review 任务：
      assignee='human', kind='once', status='pending'
      projectId = 原任务的 projectId（同一个项目）
      title = AI 自己决定（一般说明自己干了什么，如"请 review：竞品调研报告已生成"）
      description = AI 自己填写（执行摘要、产出物位置等）
      sourceTaskId = 原任务 id
  → 写 task_ops（op='review_created', note='review task id: task_xxx'）
```

用户在任务面板的**人类待处理**分组看到 review 任务，勾选完成即可。

**系统提示词中告知 AI：**
- 有哪些项目和对应的 memoryPath
- 如何创建 review 任务（`melodysync task create --assignee human --kind once ...`）
- 执行完有 reviewOnComplete=true 时必须创建 review 任务

---

## 九、等待任务 Callback 流转

```
1. AI 执行任务 A，遇到卡点
2. AI 调用：
   melodysync task create \
     --title "需要确认预算" \
     --project <id> \
     --assignee human \
     --kind once \
     --instructions "请确认后运行：melodysync task done <id> --output '结果'" \
     --source-task <task-A-id>
   → 创建人类任务 B（assignee=human, kind=once, status=pending）
   → 任务 A：status='blocked', blockedByTaskId=task-B-id

3. 人类在任务面板看到等待任务 B，完成后：
   melodysync task done <task-B-id> --output "预算确认为 50 万"

4. 系统 callback：
   → 任务 B：status='done', completionOutput='预算确认为 50 万'
   → 任务 A：status='pending', completionOutput=task-B.completionOutput
   → 自动重新触发任务 A，上下文注入 completionOutput
```

### 边界情况处理

**人类取消等待任务（任务 B 被取消）：**
```
人类取消任务 B（status → cancelled）
  → 查找 task-A（task-B.sourceTaskId）
  → 任务 A：status='pending'，blockedByTaskId=null
  → 自动重新触发任务 A 执行（不注入 completionOutput，因为未完成）
  → 写 task_ops：op='unblocked', note='waiting task cancelled'
```

**AI 任务失败后重试：**
```
melodysync task run <failed-task-id>
  → 检查 status='failed'（或 'cancelled'）
  → status → pending
  → 写 task_ops：op='status_changed', from='failed', to='pending', actor='human'
  → 调度器下次检查时触发执行（或立即触发）
```
