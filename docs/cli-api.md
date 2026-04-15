<!-- 接口设计：CLI 命令定义及 HTTP API 路由列表 -->

# CLI & HTTP API 设计

> AI 对项目数据的所有修改都通过 CLI 完成（proj_system 自迭代项目除外）。
> 所有命令支持 `--json` 输出，AI 调用时解析 JSON。

---

## CLI 命令

### 任务操作

```bash
# 查询
melodysync task list [--project <id>] [--kind once|scheduled|recurring] \
  [--assignee ai|human] [--status <status>] [--json]
melodysync task get <id> [--json]
melodysync task logs <id> [--limit 20] [--json]   # 执行日志
melodysync task ops <id> [--limit 20] [--json]    # 操作日志

# 创建（AI 任务）
melodysync task create \
  --title "每日晨报" \
  --project <id> \
  --assignee ai \
  --kind once|scheduled|recurring \
  [--executor-kind ai_prompt|script|http] \
  [--prompt "..."]                          # ai_prompt executor
  [--script "python3 ~/scripts/daily.py"]  # script executor
  [--work-dir "~/projects/xxx"]            # script 工作目录（默认 memoryPath）
  [--http-url "https://..."]               # http executor
  [--http-method GET|POST|PUT|DELETE]
  [--http-body "..."]
  [--cron "0 9 * * *"]                     # kind=recurring
  [--scheduled-at "2026-04-20T09:00"]      # kind=scheduled，ISO 8601
  [--include-last-log]                     # 注入上次执行结果
  [--review-on-complete]                   # 执行完创建人类 review 任务
  [--json]

# 创建（人类任务 / 等待任务）
melodysync task create \
  --title "需要确认预算" \
  --project <id> \
  --assignee human \
  --kind once \
  [--instructions "请确认后运行：melodysync task done <id> --output '结果'"] \
  [--source-task <blocked-ai-task-id>] \
  [--json]

# 状态变更
melodysync task done <id> [--output "完成说明"] [--json]
melodysync task cancel <id> [--json]
melodysync task run <id> [--json]          # 手动触发执行

# 修改
melodysync task update <id> \
  [--title "..."] \
  [--description "..."] \
  [--cron "..."] \
  [--scheduled-at "..."] \
  [--prompt "..."] \
  [--review-on-complete] \
  [--enable] \
  [--disable] \
  [--json]

# 删除
melodysync task delete <id> [--json]
```

---

### 项目操作

```bash
melodysync project list [--json]
melodysync project get <id> [--json]
melodysync project create --name "新项目" [--memory-path "~/projects/xxx"] [--parent <id>] [--json]
melodysync project update <id> [--name "..."] [--memory-path "..."] [--json]
melodysync project delete <id> [--json]
melodysync project archive <id> [--json]
melodysync project unarchive <id> [--json]
```

---

### 会话操作

```bash
melodysync session list [--project <id>] [--json]
melodysync session get <id> [--json]
melodysync session create [--name "..."] [--project <id>] [--tool "..."] [--model "..."] [--json]
melodysync session send <id> <text> [--json]
melodysync session update <id> [--name "..."] [--model "..."] [--tool "..."] [--project <id>] [--json]
melodysync session move <id> --project <project-id> [--json]   # 迁移到其他项目
melodysync session archive <id> [--json]
melodysync session delete <id> [--json]
```

---

### 提示词操作

```bash
melodysync prompt get [--project <id>] [--json]           # 不传 project 则查系统级
melodysync prompt set "<content>" [--project <id>]        # 设置
melodysync prompt delete [--project <id>]                 # 恢复默认值
```

---

### 系统操作

```bash
melodysync storage-maintenance [--apply] [--json]         # 清理 spool/logs，默认 dry-run
melodysync version                                        # 版本信息
melodysync info [--json]                                  # 系统信息（DB 大小、任务统计等）
```

---

## HTTP API

### Projects
```
GET    /api/projects              列出所有项目（树形）
POST   /api/projects              创建项目
GET    /api/projects/:id          获取单个项目
PATCH  /api/projects/:id          更新项目
DELETE /api/projects/:id          删除项目（非内置）
```

### Sessions
```
GET    /api/sessions              列出会话（支持 ?projectId=）
POST   /api/sessions              创建会话
GET    /api/sessions/:id          获取会话详情
PATCH  /api/sessions/:id          更新会话
DELETE /api/sessions/:id          删除会话
POST   /api/sessions/:id/messages 发送消息
GET    /api/sessions/:id/events   获取事件历史
```

### Tasks
```
GET    /api/tasks                 列出任务（支持 ?projectId= &kind= &status= &assignee=）
POST   /api/tasks                 创建任务
GET    /api/tasks/:id             获取任务详情
PATCH  /api/tasks/:id             更新任务
DELETE /api/tasks/:id             删除任务
POST   /api/tasks/:id/run         手动触发执行
POST   /api/tasks/:id/done        标记完成（人类任务）
POST   /api/tasks/:id/cancel      取消任务
GET    /api/tasks/:id/logs        获取执行日志
GET    /api/tasks/:id/ops         获取操作日志
```

### Prompts
```
GET    /api/prompts/system        获取系统级 prompt
PATCH  /api/prompts/system        更新系统级 prompt
GET    /api/prompts/project/:id   获取项目级 prompt
PATCH  /api/prompts/project/:id   更新项目级 prompt
DELETE /api/prompts/project/:id   删除项目级 prompt（恢复默认）
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
POST   /api/runtime-selection     保存运行时选择（tool/model/effort）
```
