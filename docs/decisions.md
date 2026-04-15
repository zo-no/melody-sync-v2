# 已决策项

| 项目 | 决策 |
|---|---|
| 产品定位 | 远程 AI 会话工具 + conductor 任务可视化前端 |
| 任务系统 | 不自己实现，由 conductor 负责 |
| conductor 集成方式 | MelodySync 后端 spawn conductor CLI，前端只和 MelodySync API 通信 |
| 一期复用原则 | Session / Run / Auth 优先复用 v1 已发货 contract |
| Session.projectId | 引用 conductor 的 project id；创建时可省略，默认 conductor 的默认项目 |
| Session 默认运行偏好 | tool / model / effort / thinking 存在 Session 上 |
| Session follow-up queue | 复用 v1 行为 |
| Run 角色 | 某个 Session 下的一次执行快照，复用 v1 detached run contract |
| 会话历史真值 | session_events 是 canonical truth |
| 会话自动命名 | 一期保留 |
| 认证系统 | 迁移 v1：auth + auth_sessions 两张表，Cookie ms_session |
| 认证 session 过期 | 永不过期（v1 行为） |
| CLI 认证 | 不需要，直接操作本地 SQLite |
| detached runner | 迁移 v1：fork 子进程 + spool.jsonl 文件通信 |
| WebSocket 协议 | 迁移 v1：invalidation hint + run delta 流式推送 |
| WS 连接地址 | ws://localhost:7761/ws，需 Cookie 认证 |
| task WS 推送 | 一期前端定时轮询 /api/tasks，二期再做实时推送 |
| 文件资产 | 直接迁移 v1（file-assets/ 目录） |
| spool 清理 | 手动触发（melodysync storage-maintenance），7 天后清理 |
| Provider 超时 | 迁移 v1：300s 超时，SIGTERM + 15s grace + SIGKILL |
| Runtime Selection | 通过 PATCH /sessions/:id 更新，settings 表持久化 |
| 内置项目 | 无，由 conductor 管理，MelodySync 不预置 |
| 记忆系统 | 无，由 conductor 的任务系统驱动 |
