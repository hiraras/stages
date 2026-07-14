# Stages 需求文档

> 版本：v0.2  
> 日期：2026-07-14  
> 状态：需求已确认，可进入流程总纲  
> 说明：自原 `docs/requirements.md` 按文档分层重整；实现与完整步骤见 `docs2` 下游文档。根目录使用 `docs2/`，不修改原 `docs/`。

---

## 1. 项目概述

**Stages** 是一个面向 AI 辅助开发的**跨会话改动确认与组批工具**。它提供独立于 `git add` / git index 的暂存层，让开发者在多次 AI 对话后，将已确认的代码改动分批保存、审查、合并，最终一次性应用到工作区并自行提交到 Git。

### 1.1 一句话定位

> 不是 AI 的 undo 按钮，而是开发者的「待提交改动篮子」——跨多次 AI 会话攒改动，确认后合并成一批再交给 Git。

### 1.2 与现有工具的差异

| 工具 | 定位 | Stages 的差异 |
|------|------|--------------|
| `git add` | Git 暂存区 | Stages 独立存储，不占用 index |
| ckpt | AI 会话内回滚纠错 | Stages 非破坏性审查，支持跨会话合并 |
| Cursor checkpoint | 单次对话内恢复 | Stages 跨天、跨会话，可合并多个 stage |
| Git Change Lists | IDE 内分组 git 改动 | Stages 独立于 git，有合并与 cycle 语义 |

---

## 2. 背景与目标

### 2.1 问题

AI 编程工具（Cursor、Claude Code 等）会在多次对话中持续修改代码。开发者面临：

- 改动分散在多次会话中，难以整体把握
- `git add .` 无法表达「这批是周一确认的，那批是周二确认的」
- 想先把已确认的几批改动合并提交，未确认的继续保留
- 需要在 IDE 中查看每个 stage 的增量 diff

### 2.2 目标

1. 手动保存每次确认的代码改动为 **stage**
2. 每个 stage 展示相对上一 stage（或基线）的**增量 diff**
3. 支持将多个未提交的、**ID 连续**的 stage **合并**为一个
4. 合并后的结果可经 **`stages commit` 应用到工作区**，由用户自行 `git commit`
5. 在 VS Code / Cursor 中可视化查看 stage / commit / 未 stage 改动的 diff
6. 全程**不影响** git index 和 `git status`（除用户自行执行的 git 操作外）

### 2.3 非目标（MVP 不做）

- AI 自动监听与自动快照（如 ckpt watch）
- 硬回滚工作区（`git reset --hard` 式恢复）
- 替代 Git 成为版本控制系统
- 多人协作 / 远程同步
- 按文件 / 按行选择性采纳
- `stages revert`（回滚到某个 stage 状态）
- AI agent 集成（自动 stages）
- 与 ckpt 互操作
- 多项目管理

### 2.4 MVP 明确包含（纠正旧文档矛盾）

下列能力**属于** MVP，需求与任务中不得标为「后续迭代」：

- **`stages drop`**：按序号截断删除当前 cycle 未提交 stage，并恢复工作区到有效快照
- **`.stagesignore`**：可选忽略规则，与 `.gitignore` 一并约束保存范围

---

## 3. 已确认的核心决策

| # | 决策项 | 确认结果 |
|---|--------|----------|
| 1 | 第一个 stage 的基线 | **当前 git HEAD**（最近一次 commit） |
| 2 | 保存文件范围 | **工作区所有文件**，遵循 `.gitignore` 与 **`.stagesignore`（可选）** |
| 3 | 提交到 git 的方式 | **`stages commit` 将快照应用到工作区**，用户自行 `git add` + `git commit` |
| 4 | MVP 交付范围 | **CLI + 基础 VS Code/Cursor 扩展** |
| 5 | stage 合并规则 | **连续的、未提交的** stage 可合并；支持重命名；已提交不可再合并 |
| 6 | 合并时快照策略 | **就地合并到第一个 stage**：取**最后一个**被合并 stage 的 manifest 写入保留的 ID，**不生成新 ID** |
| 7 | `stages commit` 后 | 本 cycle 的 stage 归档到该 commit；**stage ID 从 `stage-001` 重置**；**baseline 更新为该 commit 的快照**（后续 diff 相对此 baseline，**不依赖**用户是否已 `git commit`） |
| 8 | 脏工作区时 commit / drop | **默认拒绝**并提示；`--force` 用目标快照**覆盖**未 stage 改动 |
| 9 | stage ID 格式 | 自动递增：`stage-001`、`stage-002`；drop **不回收** `nextId` |
| 10 | 初始化 | 支持 `stages init`；首次 `stages` 也可自动初始化 |
| 11 | 存储方案（需求层） | **文件快照 + 内容寻址去重**；不使用 shadow git |
| 12 | `drop` | **MVP 包含**（详见后续流程细则，不在本文展开完整规格） |
| 13 | cycle 与 ID 作用域 | 见下方 **§3.1** |

### 3.1 Cycle 与 stage ID 作用域（总原则）

每次成功的 **`stages commit` 后，stage ID 从 `stage-001` 重新计数**，因此不同 cycle 会出现**相同 ID**（例如多个历史上的 `stage-003`）。硬性约定：

1. **当前 cycle**：自上次 `stages commit` 之后（或自 `init` 至首次 commit）尚未归档的 stage 序列。
2. **对 stage 的写入类操作**（`merge` / `rename` / `drop`）以及 **数字简写**（如 `show 1`、`drop 3`）**仅匹配当前 cycle** 中未归档（无 `commitId`）的 stage。
3. **历史 cycle** 的 stage 已随对应 commit 归档：默认不出现在 `list` / 扩展当前列表中；可用 `list --all` 查看元数据；一般**不再**参与 merge / rename / drop。
4. 需要指向历史 stage 时使用**完整 ID**，并结合创建时间 / `commitId` 区分同名条目（删除等写操作按 `id + createdAt` 精确匹配，避免误伤历史）。
5. **`stages log` / commit 历史**与当前 cycle 的 stage 列表分开：log 只列 commit；`show commit-*` 查看相邻 commit 增量。

---

## 4. 用户场景

（叙述：谁、为何、成功什么样。完整可执行步骤见流程总纲 `docs2/business-flow.md`。）

### 4.1 跨会话组批提交

开发者在多日、多次 AI 会话中分别审查并保存 stage。某天决定若干已确认 batch 可以进 Git：将其合并（可选）、在 IDE 中复核累计改动，执行 `stages commit` 应用到工作区，再自行 `git commit`。尚未确认的 stage 保留在当前 cycle，且不污染 git。

### 4.2 单 stage 审查

一轮 AI 修改后，开发者保存为 stage，在 Cursor/VS Code 侧边栏打开该 stage，查看相对上一 stage（或基线）的文件级 diff，确认无误后再继续下一轮对话。

### 4.3 合并后命名

开发者将若干连续未提交 stage 合并为一个，并赋予业务含义的名称；之后仍可对未提交的 stage 重命名。

---

## 5. 功能需求

本章描述**要什么**与**硬性约束**；命令参数表、错误码、存储字段、算法实现见 `docs2/features/*` 与 `system-design.md`。

### 5.1 CLI

| 能力 | 需求摘要 |
|------|----------|
| **保存 stage**（`stages` / `stages snap`） | 将当前工作区相对基线或上一 stage 的改动存为新 stage；支持 `-m` / `--message`；不改工作区内容、不改 git index；无新改动时不创建空 stage，并提示 `No new changes.` |
| **列表**（`stages list`） | 默认列出**当前 cycle** 可见 stage（merged 默认隐藏）；`--all` 可含历史归档与隐藏项 |
| **查看**（`stages show`） | 查看 stage 或 commit 的 diff；stage 支持数字简写（仅当前 cycle）、`--stat`、`--open`；commit 支持简写与 `--stat`，MVP 不要求 `--open` |
| **合并**（`stages merge`） | 仅连续未提交 stage；就地合并到第一个 ID 并 `--name` 重命名；其余标记为已合并并默认隐藏；后续指针重定向到保留 stage |
| **重命名**（`stages rename`） | 未提交（pending/ready）可改名；已 committed 不可 |
| **提交到工作区**（`stages commit -m`） | 取当前 cycle 最新 active stage 快照应用到工作区；创建 commit 节点；归档本 cycle；重置 stage 编号；更新 baseline；**不**自动 `git commit`；脏工作区默认失败，`--force` 覆盖 |
| **历史**（`stages log`） | 查看 commit 历史（当前 cycle 的 stage 不在此列出） |
| **门禁**（`stages verify`） | 供构建前使用：存在未 commit 的 stage 或未 stage 改动则失败；未 init / 无历史等可跳过并提示（细则见 feature） |
| **丢弃**（`stages drop`） | 删除当前 cycle 中序号 ≥ N 的未提交 stage（含范围内 merged 元数据），工作区恢复到删除前有效快照；需确认（或 `--yes`）；脏工作区规则同 commit |
| **初始化**（`stages init`） | 创建存储与初始元数据；`.stages/` 写入 `.gitignore`；记录 git HEAD 为初始 baseline；工作区相对 HEAD 有改动时可自动创建第一个 stage |
| **概况**（`stages status`） | 显示当前项目 stages 概况 |

**Stage 状态（需求层）：**

| 状态 | 含义 |
|------|------|
| `pending` | 已保存，未提交（含合并后保留的 stage） |
| `merged` | 已被合并吸收，默认不在 list 中显示 |
| `ready` | 与 `pending` 同义，保留兼容 |
| `committed` | 已随 `stages commit` 归档完成 |

### 5.2 VS Code / Cursor 扩展

**MVP 必须提供：**

- 在 Source Control 区域展示 Stages：**Unstaged Changes**（相对最新 stage / baseline 的未保存改动，有则默认展开）→ **当前 cycle** 的 stage（新 → 旧）→ **commit 历史**（新 → 旧）
- 文件级左右 diff（stage / commit / unstaged 语义与 CLI 一致）
- 刷新（含 CLI 变更后可见更新）
- 未提交 stage：重命名、Drop（含确认）

**MVP 不做：**

- 在扩展内执行 merge / commit（通过 CLI）
- 按行采纳 / 拒绝
- 与 Git 面板深度联动
- commit 的重命名 / 隐藏 / 删除

界面与交互细节、虚拟 URI 等见流程细则与系统设计。

### 5.3 存储原则（需求层）

- 所有 Stages 数据存放在项目内 `.stages/`，独立于 git index，不创建隐藏 git 分支
- 初始化时将 `.stages/` 加入 `.gitignore`（若尚未存在）
- 目录布局、meta 字段、blob 去重实现 → 系统设计

### 5.4 与 Git 的边界

| 操作 | 影响 git index | 影响 working tree | 影响 git history |
|------|----------------|-------------------|------------------|
| `stages`（snap） | 否 | 否 | 否 |
| `stages show` / `list` / `log` / `status` / `verify` | 否 | 否 | 否 |
| `stages merge` / `rename` | 否 | 否 | 否 |
| `stages commit`（及需覆盖工作区的 `--force`） | 否 | **是** | 否 |
| `stages drop`（恢复工作区） | 否 | **是** | 否 |
| 用户 `git commit` | 是 | 否（内容已在工作区） | 是 |

**前提：** 项目必须是 git 仓库，以便用 HEAD 建立初始 baseline。

### 5.5 Diff 语义（用户可见）

- **普通 stage：** 相对上一 stage 快照的增量；当前 cycle 第一个 stage 相对**当时 cycle baseline**（首 cycle 为 git HEAD；`stages commit` 之后为上一 commit 快照）
- **合并后的 stage（show / IDE）：** 相对其父级 / baseline 的**累计**差异（与就地合并后的最终快照一致）
- **commit show：** `commit-001` 相对初始 git HEAD（`meta` 中记录的原始 HEAD）；其后相邻 commit 之间为增量
- **文件变更类型：** 新增 / 修改 / 删除，左右侧为空或对应版本内容

具体对比端点与实现公式 → 流程细则 / 系统设计。

---

## 6. 约束与假设

### 6.1 非功能

| 类别 | 要求 |
|------|------|
| 性能 | 单次保存约 100 个文件以内目标 &lt; 2s |
| 存储 | 支持内容寻址去重，避免重复存储未变文件 |
| 兼容 | Node.js &gt;= 18；VS Code &gt;= 1.85；Cursor 兼容 |
| 安装 | `npx stages` 或 `npm install -g stages` |
| 安全 | 不收集 / 上传任何数据，纯本地运行 |

### 6.2 假设

- 用户以「确认一批 AI 改动再保存」的方式使用；MVP 不强制与某一 AI 产品深度集成
- 文档与任务拆分按 `new-system-dev`：`requirements` → `business-flow` → `features/*` → `system-design` → `tasks/project`

### 6.3 术语表

| 术语 | 定义 |
|------|------|
| **stage** | 一次手动保存的代码改动快照 |
| **baseline** | 当前 cycle 对比基线：初始为 git HEAD；每次成功的 `stages commit` 后更新为该 commit 快照 |
| **cycle** | 两次 `stages commit` 之间（或自 init 至首次 commit）的 stage 序列 |
| **增量 diff** | 相邻两个快照之间的文件差异 |
| **累计 diff** | 某 stage 相对其累计起点（如 cycle baseline）的全部差异 |
| **merge** | 将多个连续未提交 stage 就地合并为第一个 stage 并重命名 |
| **commit**（stages 语义） | 将当前 cycle 累计快照应用到工作区并归档，**不是** `git commit` |

---

## 7. 验收标准

### 7.1 原则

1. 常规 snap / show / merge / rename / list **不改变** git index 与 git history  
2. Diff 语义符合 §5.5；合并为就地策略且 ID 规则符合 §3  
3. `stages commit` / `drop` 对工作区的影响与脏工作区 / `--force` 规则符合 §3、§5.1  
4. 扩展能展示 Unstaged、当前 cycle stage、commit 历史，并打开与 CLI 一致的文件级 diff  
5. `drop` 与 `.stagesignore` 作为 MVP 能力可验收，不得缺失  

### 7.2 关键项（条目；可勾选清单在任务库）

**CLI**

- 在 git 仓库中 `stages` 可生成 `stage-001`，且不改变 `git status`（index）  
- 多次保存后 `list` / `list --all` 行为符合隐藏与历史规则  
- `show` 对 stage / commit 的增量或累计语义正确；数字简写仅匹配当前 cycle  
- `merge` 仅允许连续未提交；成功后保留首 ID 与新名称  
- `rename` / `commit` / `drop` / `init` / `verify` / `status` / `log` 符合 §5.1  
- 无新改动时 snap 提示 `No new changes.` 且不建空 stage  
- 脏工作区 commit/drop 默认失败，`--force` 可覆盖  

**扩展**

- 三区展示顺序与排序符合 §5.2  
- Unstaged / stage / commit 文件 diff 加载正确  
- CLI 变更后列表可刷新  
- Rename / Drop 仅对允许的 stage 可用；commit 只读  

完整勾选列表与阶段任务见 `docs2/tasks/project/`（步骤 5 建立）。

---

## 8. MVP 范围（叙述，无勾选）

**包含：** CLI 核心命令（含 init、snap、list、show、merge、rename、commit、log、verify、drop、status）；独立 `.stages/` 存储；增量 / 累计 diff；连续就地合并；`.stagesignore`；VS Code/Cursor 扩展侧栏与文件级 diff（含 Unstaged 与 commit 历史展示）。

**不包含：** §2.3 所列非目标；扩展内 merge/commit；按行采纳。

任务拆分与进度跟踪不在本文维护。
