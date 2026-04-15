# MelodySync v2 架构概览

> 详细文档见 [docs/README.md](README.md)

## 产品定位

MelodySync v2 是一个**本地优先的 AI 任务工作台**，单用户。

核心理念：
- **会话**是对话记录，用于人与 AI 交流
- **任务**是独立的可执行单元，与会话完全解耦
- **项目**是组织维度，会话和任务都归属于项目
- **AI 通过 CLI/API 操作任务**，人类通过 Web UI 查看和管理
- **记忆和自迭代**是内置的长期项目，通过任务系统驱动

## 顶层数据模型

```
proj_global（全局，根节点，内置不可删）
├── proj_daily（日常事务，内置不可删）
│   ├── 会话（新建会话默认归属）
│   └── 任务
│
├── proj_memory（记忆维护，内置不可删）
│   ├── memoryPath: ~/.melodysync/memory/（用户可改）
│   └── 预置任务
│       ├── 每日记忆整理（recurring, 23:00）
│       └── 每周记忆清理（recurring, 周一 09:00）
│
├── proj_system（MelodySync 自迭代，内置不可删）
│   ├── memoryPath: ~/.melodysync/system/（用户可改）
│   └── 预置任务（默认启用）
│       └── 系统稳定性检查（recurring, 每天 08:00）
│           检查失败/阻塞/超时任务，结果写入 stability/YYYY-MM-DD.md
│           发现异常时创建人类待处理任务
│
└── 用户长期项目（用户创建，最多 2 层）
    ├── 会话
    ├── 子项目
    └── 任务
```

### 内置项目一览

| id | name | parentId | 默认 memoryPath | 说明 |
|---|---|---|---|---|
| `proj_global` | 全局 | — | — | 根节点 |
| `proj_daily` | 日常事务 | `proj_global` | — | 新建会话默认归属 |
| `proj_memory` | 记忆维护 | `proj_global` | `~/.melodysync/memory/` | 全局积累知识 |
| `proj_system` | MelodySync 自迭代 | `proj_global` | `~/.melodysync/system/` | 系统自我优化 |

### 关键规则

1. 每个会话和任务都归属于某个项目
2. 新建会话默认归入"日常事务"，用户可手动迁移
3. 项目支持子项目，最多 2 层
4. 内置 4 个项目不可删除
5. `proj_memory` 和 `proj_system` 的 memoryPath 用户可自定义（如 Obsidian vault、iCloud）

## 文档导航

- 数据结构详情 → [data-model.md](data-model.md)
- 记忆系统 → [memory-system.md](memory-system.md)
- 执行模型 → [execution-model.md](execution-model.md)
- 数据库 Schema → [database-schema.md](database-schema.md)
- 架构实现 → [implementation-guide.md](implementation-guide.md)
- CLI & API → [cli-api.md](cli-api.md)
- Web UI → [ui-design.md](ui-design.md)
- 已决策项 → [decisions.md](decisions.md)
- 一期范围 → [roadmap.md](roadmap.md)

