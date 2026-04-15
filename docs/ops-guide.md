<!-- 运维指南：服务启动、停止、日志管理 -->

# 运维指南

## 启动服务

```bash
# 开发模式（热重载）
pnpm dev:server    # 后端，port 7761
pnpm dev:web       # 前端，port 5173

# 生产模式
bun packages/server/src/server.ts
```

## 停止服务

```bash
# 查找进程
lsof -i :7761

# 停止
kill $(lsof -ti :7761)
```

## 查看日志

```bash
# 运行时日志
tail -f ~/.melodysync/runtime/logs/server.log

# 任务执行日志
melodysync task logs <task-id>

# 任务操作日志
melodysync task ops <task-id>
```

## 存储维护

```bash
# 查看需要清理的内容（dry-run）
melodysync storage-maintenance

# 执行清理
melodysync storage-maintenance --apply
```

## 数据库位置

默认：`~/.melodysync/runtime/sessions/sessions.db`

自定义：设置环境变量 `MELODYSYNC_DB_PATH`

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `MELODYSYNC_DB_PATH` | SQLite 数据库路径 | `~/.melodysync/runtime/sessions/sessions.db` |
| `MELODYSYNC_BRAIN_ROOT` | 记忆根目录 | `~/.melodysync/` |
| `MELODYSYNC_RUNTIME_ROOT` | 运行时根目录 | `~/.melodysync/runtime/` |
| `MELODYSYNC_INSTANCE_ROOT` | 完全隔离实例（覆盖所有路径） | — |
| `PORT` | HTTP server 端口 | `7761` |
