<!-- 范围规划：一期交付 checklist 及二期规划 -->

## 十七、一期范围

### 一期交付

**后端（server）**
- [ ] Project CRUD（含 4 个内置项目初始化 + 预置任务写入）
- [ ] Session CRUD + 事件历史（SQLite）
- [ ] Task CRUD（assignee/kind 正交，含调度配置）
- [ ] TaskLog + TaskOps
- [ ] ai_prompt / script / http 三种执行器
- [ ] 调度器（recurring / scheduled，错过丢弃）
- [ ] 等待任务 callback 流转
- [ ] 提示词三层（system_prompts 表）
- [ ] 上下文组装（固有知识注入 + INDEX.md + 提示词三层）
- [ ] 认证系统（迁移 v1：token/password/cookie）
- [ ] WebSocket 实时推送（迁移 v1：invalidation hint）
- [ ] 文件资产（迁移 v1：file-assets/）
- [ ] Session Run（迁移 v1：detached runner + spool）
- [ ] 存储维护 CLI（melodysync storage-maintenance，手动触发清理 spool/logs）
- [ ] CLI（project / session / task / prompt / storage 子命令，--json 支持）
- [ ] HTTP API（全部路由）

**前端（web）**
- [ ] PC 端布局（侧边栏项目列表可折叠 + 主区域）
- [ ] 移动端布局（横向滚动项目 tab）
- [ ] 会话列表（名称 + 项目标签 + 时间，自动命名）
- [ ] 聊天视图（迁移 v1）
- [ ] 任务列表（微信待办风格，checkbox + 分组）
- [ ] 任务详情（人类任务 / AI 任务两种布局）
- [ ] 任务编辑面板（字段按 assignee+kind 组合显示）
- [ ] 项目创建/编辑 UI（名称 + memoryPath）
- [ ] 会话迁移项目（会话列表右键/操作菜单）

**开发文档**
- [ ] AGENTS.md（AI 协作说明，如何读代码）✓
- [ ] 本文档（architecture.md）持续更新 ✓

### 二期规划

- hooks 系统（自定义事件触发 shell 命令）
- 记忆系统 UI（INDEX.md 可视化编辑）
- 任务依赖关系（任务间的前置/后置关系）
- 迁移工具（从 v1 导入数据）
- 存储维护自动化（启动时或定时自动清理）
