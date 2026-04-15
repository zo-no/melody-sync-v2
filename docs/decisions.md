<!-- 已决策项：所有设计决策的完整汇总表格 -->

## 十六、已决策项

| 项目 | 决策 |
|---|---|
| 项目字段 | name + memoryPath，无 goal 字段 |
| 内置项目 | 4 个：global / daily / memory / system |
| proj_memory 默认路径 | `~/.melodysync/memory/` |
| proj_system 默认路径 | `~/.melodysync/system/` |
| memoryPath 可自定义 | 是，支持 Obsidian vault / iCloud 等 |
| 知识库入口文件 | 每个 memoryPath 下约定 `INDEX.md`（agent 必读） |
| INDEX.md 维护者 | 该项目下的记忆维护任务（AI 写） |
| README.md | 给人类看，不是 agent 入口 |
| 固有知识 vs 积累知识 | 固有知识从 SQLite 动态生成注入，积累知识存文件 |
| 注入顺序 | 固有知识 → INDEX.md → 提示词三层 |
| 项目层级上限 | 最多 2 层 |
| 任务执行隔离 | 暂不隔离 |
| script 工作目录 | 可配置，默认 memoryPath |
| 执行超时 | 默认 300 秒 |
| 执行日志大小 | 截断至 64KB |
| 任务日志保留 | 每个任务最近 50 条 |
| 调度器实现 | 进程内 croner + 内存 job registry + 启动时 reconcile |
| 调度器精度 | 秒级（croner 支持） |
| 调度器部署 | 单进程，services/ 层，server 启动时初始化 |
| 启动顺序 | initDb → reconcileTasks → startScheduler → startServer |
| reconcile 策略 | 启动时把 running 任务重置为 pending，写 task_ops 记录 |
| 错过的调度任务 | 丢弃，记录 skipped，不补跑 |
| 重启后调度 | 不回头触发，下次 cron 时间正常触发 |
| 任务 assignee/kind 设计 | 两个字段正交：assignee 决定谁执行，kind 决定触发方式 |
| 人类任务 status | pending / done / cancelled |
| AI 任务 status | pending / running / done / failed / cancelled / blocked |
| 等待任务 callback | CLI/API 标记完成，自动恢复原任务 |
| reviewOnComplete | ExecutorOptions 字段，默认 false，true 时执行完自动创建人类 review 任务 |
| review 任务归属 | 和原任务同一个项目 |
| review 任务内容 | AI 自己决定标题和描述，一般说明执行了什么、产出在哪里 |
| review 任务记录 | task_ops 写 op='review_created' |
| task_logs 保留 | 任务删除时级联删除，最近 50 条 |
| task_ops 保留 | 永久保留，任务删除时不级联（保留历史） |
| task_ops 给谁看 | 主要给 AI 看，用于后续迭代分析 |
| task_ops 索引 | 写入系统 INDEX.md，AI 知道通过 CLI 查询 |
| 任务列表风格 | 参考微信待办，checkbox + 标题 + 右侧时间/图标 |
| 人类任务 checkbox | 可勾选完成，AI 任务不可勾选 |
| 任务详情位置 | 右侧主区域，和聊天视图同一区域切换 |
| 任务编辑 | 点击编辑按钮弹出面板，字段按 assignee+kind 组合显示 |
| 会话列表字段 | 名称 + 所属项目标签 + 时间 |
| 会话自动命名 | 一期保留（成本低，体验关键） |
| hooks 系统 | 二期再做 |
| 提示词层级 | 系统级 → 项目级 → 任务级 |
| 会话事件历史 | 迁入 SQLite，大 body 外部化到文件 |
| 认证系统 | 迁移 v1：auth + auth_sessions 两张表，Cookie ms_session |
| 认证 session 过期 | 永不过期（v1 行为） |
| CLI 认证 | 不需要，直接操作本地 SQLite |
| detached runner | 迁移 v1：fork 子进程 + spool.jsonl 文件通信 |
| spool 作用 | 子进程写入 AI 流式输出，主进程读取推送 WS，finalize 后转 session_events |
| WebSocket 协议 | 迁移 v1：invalidation hint + run delta 流式推送 |
| WS 连接地址 | ws://localhost:7761/ws，需 Cookie 认证 |
| WS 数据原则 | HTTP 是 canonical，WS 只是通知，断线重连后 HTTP 拉最新 |
| 文件资产 | 直接迁移 v1（file-assets/ 目录，元数据存 SQLite） |
| AI 开发友好化 | 维护好开发文档，写清楚如何读（见 AGENTS.md） |
| hooks 系统 | 二期 |
| Session Run spool | 继续用文件系统（diagnostic，7 天后清理） |
| script executor 输出 | 迁移 v1：流式处理，逐行读取 stdout，实时追加 spool，和 AI 执行走同一套管道 |
| prompt 变量替换 | 在 context.ts 组装层做 replaceAll，支持 {memoryPath}、{date} 等占位符 |
| file-assets 消息关联 | 迁移 v1：assetId 引用，multipart 上传，执行前 materialize 到本地缓存 |
| AI provider 调用 | 迁移 v1：adapter 模式，spawn 子进程调用 Claude CLI |
| 聊天视图实现 | 用 React 重新实现，逻辑参考 v1 transcript-ui/compose/surface-ui |
| WS 断线重连 UI | 迁移 v1：3 秒重连，状态点变灰，输入框禁用，重连后增量刷新 |
| session 事件历史 body 外部化 | 完全迁移 v1 设计 |
| 任务开关 | enabled 字段，false 时调度器跳过，任务列表变灰显示"已暂停" |
| 关闭任务的显示 | 仍显示在列表，变灰 + "已暂停"标签，不隐藏 |
| 竞品调研预置任务 | 删除，不预置 |
| 稳定性检查预置任务 | 保留，每天 08:00，检查失败/阻塞/卡住的任务 |
| 稳定性检查输出 | 按天记录到 {memoryPath}/stability/YYYY-MM-DD.md |
| AI 任务失败重试 | task run 可重试 failed/cancelled 任务，status 回到 pending |
| 人类取消等待任务 | 被阻塞的 AI 任务自动变回 pending，重新执行，不注入 completionOutput |
| scheduled 任务时间校验 | scheduledAt < now 时拒绝创建，返回错误 |
| task run 重试 | 支持 failed 和 cancelled 状态的任务重新触发 |
| memoryPath 目录 | 启动时自动 mkdirSync，目录不存在时自动创建 |
| Cookie 过期策略 | HttpOnly + 无过期，与 auth_sessions 永不过期保持一致 |
| --project 参数 | task create 时必须，session create 时可选（默认 proj_daily） |
