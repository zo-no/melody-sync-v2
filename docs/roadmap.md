# 一期范围

## 前提：conductor 已可用

MelodySync v2 依赖 conductor CLI。一期开发前需要确认 conductor 的以下命令可用：
- `conductor project list --json`
- `conductor task list --project <id> --json`
- `conductor task create ...`
- `conductor task done/cancel/run ...`

## 一期交付

**后端（server）**
- [ ] Session CRUD + 事件历史（SQLite）
- [ ] Session Run（迁移 v1：detached runner + spool）
- [ ] 认证系统（迁移 v1：token/password/cookie）
- [ ] WebSocket 实时推送（迁移 v1：invalidation hint + run delta）
- [ ] 文件资产（迁移 v1：file-assets/）
- [ ] conductor 集成层（services/conductor.ts）
- [ ] Tasks / Projects HTTP API（代理 conductor CLI）
- [ ] CLI（session / run 子命令，--json 支持）
- [ ] 存储维护 CLI（melodysync storage-maintenance）

**前端（web）**
- [ ] PC 端布局（侧边栏 + 主区域）
- [ ] 移动端布局（横向滚动项目 tab）
- [ ] 会话列表（名称 + 项目标签 + 时间）
- [ ] 聊天视图（迁移 v1）
- [ ] 任务列表（从 conductor 获取，checkbox + 分组）
- [ ] 任务详情（human / AI 两种布局）
- [ ] 任务编辑面板（字段按 assignee+kind 组合显示）
- [ ] 项目切换（从 conductor 获取项目列表）
- [ ] 会话迁移项目（会话列表右键/操作菜单）

**开发文档**
- [ ] AGENTS.md 持续更新 ✓
- [ ] 本文档持续更新 ✓

## 二期规划

- conductor WebSocket 推送（任务变更实时同步，替代前端轮询）
- 记忆系统 UI（conductor 任务的 workDir 文件可视化）
- 迁移工具（从 v1 导入数据）
- 存储维护自动化
