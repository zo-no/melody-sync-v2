<!-- 记忆系统设计：INDEX.md 约定、文件目录结构、记忆注入流程 -->

## 四、记忆系统设计

### 核心原则

记忆分两类，边界严格分离：

| 类型 | 来源 | 存储位置 | 注入方式 |
|---|---|---|---|
| **固有知识** | 数据库（项目名、id、路径） | SQLite | 代码动态生成，直接注入系统提示词 |
| **积累知识** | AI 通过任务写入的文件 | memoryPath 下的文件 | agent 读 INDEX.md 后自己决定读什么 |

**固有知识不存文件，积累知识不存数据库。**

---

### INDEX.md 约定

每个配置了 `memoryPath` 的项目，其目录下约定 `INDEX.md` 作为**知识库入口**：

- 由该项目下的记忆维护任务负责创建和更新
- Agent 进入任何会话或任务时，先读对应的 `INDEX.md`
- `INDEX.md` 告诉 agent 这个知识库里有什么，agent 自己决定深入读哪些文件
- 系统不约定 `INDEX.md` 以外的文件格式和结构

**示例 `~/.melodysync/memory/INDEX.md`（由记忆整理任务维护）：**

```markdown
# 全局记忆索引
更新时间：2026-04-15

- prefs.md — 用户工作偏好和沟通风格
- skills.md — 用户技能背景
```

**示例 `~/code/melody-sync/INDEX.md`（由项目记忆任务维护）：**

```markdown
# MelodySync 开发记忆索引
更新时间：2026-04-15

- decisions.md — 架构决策记录
- progress.md — 当前进度和下一步
```

---

### 文件目录结构

```
~/.melodysync/
├── memory/                         # proj_memory.memoryPath（用户可改）
│   ├── INDEX.md                    # 全局积累知识入口（agent 必读）
│   ├── prefs.md                    # 用户偏好（AI 维护）
│   └── skills.md                   # 用户技能背景（AI 维护）
│
├── system/                         # proj_system.memoryPath（用户可改）
│   ├── INDEX.md                    # 系统自迭代知识入口（agent 必读）
│   ├── research.md                 # 竞品调研记录（AI 维护）
│   └── stability.md                # 稳定性检查记录（AI 维护）
│
└── runtime/                        # 运行时数据（不注入 agent）
    ├── sessions.db                 # SQLite 主数据库
    ├── sessions/
    │   ├── history/                # 事件 body 外部化
    │   └── runs/                   # spool.jsonl + artifacts
    └── logs/

~/任意用户项目目录/                  # project.memoryPath（用户自定义）
├── INDEX.md                        # 项目积累知识入口（agent 必读，如果存在）
└── ...用户自己的文件
```

---

### 记忆注入流程

**会话启动时**和**任务执行时**，系统提示词注入以下内容：

```
[1] 固有知识（代码从 SQLite 实时生成）

    当前项目：MelodySync 开发 [proj_abc]
    项目目录：~/code/melody-sync/

    所有长期项目：
    - 日常事务 [proj_daily]
    - 记忆维护 [proj_memory] → ~/.melodysync/memory/
    - MelodySync 自迭代 [proj_system] → ~/.melodysync/system/
    - MelodySync 开发 [proj_abc] → ~/code/melody-sync/
    - 读书计划 [proj_def] → ~/notes/books/

[2] 积累知识入口（系统自动读取，如果文件存在）

    全局记忆 INDEX.md 内容（~/.melodysync/memory/INDEX.md）
    当前项目 INDEX.md 内容（~/code/melody-sync/INDEX.md）

[3] 提示词三层（追加）

    系统级 prompt
    项目级 prompt
    任务级 prompt（任务执行时）
```

Agent 读完 `[1]` 和 `[2]` 后，知道所有项目的位置和积累知识的索引，自己决定深入读哪些文件。
