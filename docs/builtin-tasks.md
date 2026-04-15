<!-- 内置预置任务定义：prompt 内容、调度配置、执行器配置 -->

# 内置预置任务

系统初始化时自动创建的预置任务。用户可以修改 prompt、调整调度时间、或通过 enable/disable 开关控制。

---

## proj_memory：记忆维护

### 每日记忆整理

| 字段 | 值 |
|---|---|
| title | 每日记忆整理 |
| kind | recurring |
| cron | `0 23 * * *`（每天 23:00） |
| assignee | ai |
| executor_kind | ai_prompt |
| enabled | true |
| reviewOnComplete | false |

**prompt：**
```
读取今天的会话记录和任务执行日志，整理以下内容并更新 {memoryPath} 下对应的文件：
1. 用户今天提到的偏好、习惯、决策
2. 项目进展和关键结论
3. 需要长期记住的背景知识

更新 INDEX.md 保持索引准确。如果没有值得记录的内容，跳过即可。
```

---

### 每周记忆清理

| 字段 | 值 |
|---|---|
| title | 每周记忆清理 |
| kind | recurring |
| cron | `0 9 * * 1`（每周一 09:00） |
| assignee | ai |
| executor_kind | ai_prompt |
| enabled | true |
| reviewOnComplete | false |

**prompt：**
```
扫描 {memoryPath} 下所有记忆文件，清理以下内容：
1. 过期或已失效的信息（超过 3 个月且不再相关）
2. 重复的条目（合并相似内容）
3. 已完成项目的临时记录

更新 INDEX.md 保持索引准确。
```

---

## proj_system：MelodySync 自迭代

### 系统稳定性检查

| 字段 | 值 |
|---|---|
| title | 系统稳定性检查 |
| kind | recurring |
| cron | `0 8 * * *`（每天 08:00） |
| assignee | ai |
| executor_kind | ai_prompt |
| enabled | true |
| reviewOnComplete | false |

**prompt：**
```
检查 MelodySync 系统的任务执行健康状况：

1. 查询最近 24 小时内失败的任务：
   melodysync task list --status failed --json

2. 查询当前被阻塞的任务：
   melodysync task list --status blocked --json

3. 查询长时间处于 running 状态的任务（可能卡住，超过 1 小时）：
   melodysync task list --status running --json

4. 统计各项目最近 7 天的任务完成情况：
   melodysync task list --status done --json

将检查结果写入 {memoryPath}/stability/{今天日期}.md（格式：YYYY-MM-DD.md）。

如发现以下异常情况，创建人类待处理任务说明问题：
- 有任务失败超过 3 次（同一任务）
- 有任务卡在 running 超过 1 小时
- 有任务被阻塞超过 3 天
```

---

## 说明

- 预置任务在系统初始化（首次启动）时自动写入数据库
- 用户可以修改任何字段（prompt、cron、enabled 等）
- 内置项目不可删除，但预置任务可以删除
- 未来可以通过提需求 → 更新本文档 → 开发的方式增加新预置任务
