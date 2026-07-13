# Stages 需求文档

> 版本：v0.1  
> 日期：2026-07-10  
> 状态：需求已确认，可进入实现计划

---

## 1. 项目概述

**Stages** 是一个面向 AI 辅助开发的**跨会话改动确认与组批工具**。它提供独立于 `git add` / git index 的暂存层，让开发者在多次 AI 对话后，将已确认的代码改动分批保存、审查、合并，最终一次性提交到 Git。

### 1.1 一句话定位

> 不是 AI 的 undo 按钮，而是开发者的「待提交改动篮子」——跨多次 AI 会话攒改动，确认后合并成一批再 commit。

### 1.2 与现有工具的差异

| 工具 | 定位 | Stages 的差异 |
|------|------|--------------|
| `git add` | Git 暂存区 | Stages 独立存储，不占用 index |
| ckpt | AI 会话内回滚纠错 | Stages 非破坏性审查，支持跨会话合并 |
| Cursor checkpoint | 单次对话内恢复 | Stages 跨天、跨会话，可合并多个 stage |
| Git Change Lists | IDE 内分组 git 改动 | Stages 独立于 git，有合并语义 |

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
2. 每个 stage 展示相对上一 stage 的**增量 diff**
3. 支持将多个未提交的 stage **合并**为一个 batch
4. 合并后的 batch 可**应用到工作区**，由用户自行 `git commit`
5. 在 VS Code / Cursor 中可视化查看每个 stage 的 diff
6. 全程**不影响** git index 和 `git status`

### 2.3 非目标（MVP 不做）

- AI 自动监听与自动快照（如 ckpt watch）
- 硬回滚工作区（`git reset --hard` 式恢复）
- 替代 Git 成为版本控制系统
- 多人协作 / 远程同步
- 按文件 / 按行选择性采纳（后续迭代）

---

## 3. 已确认的核心决策

| # | 决策项 | 确认结果 |
|---|--------|----------|
| 1 | 第一个 stage 的基线 | **当前 git HEAD**（最近一次 commit） |
| 2 | 保存文件范围 | **工作区所有文件，遵循 `.gitignore`** |
| 3 | 提交到 git 的方式 | **`stages commit` 将 diff 应用到工作区，用户自行 `git commit`** |
| 4 | MVP 交付范围 | **CLI + 基础 VS Code/Cursor 扩展一起做** |
| 5 | stage 合并规则 | **连续的、未提交的 stage 可合并；支持重命名 stage；已提交不可再合并** |
| 6 | 合并时快照策略 | **就地合并到第一个 stage**（取最后一个 stage 的 manifest 写入，不生成新 ID） |
| 7 | commit 后 stage 处理 | **保留历史，标记 `committed`；用户可选择隐藏** |
| 8 | 脏工作区时 commit | **警告并需 `--force` 确认；`--force` 会用最新 stage 快照覆盖未 stage 的改动** |
| 9 | stage ID 格式 | **自动递增**：`stage-001`、`stage-002` |
| 10 | 初始化方式 | **支持 `stages init`**；首次 `stages` 也可自动初始化 |
| 11 | 存储方案 | **文件快照 + 内容寻址 blob 去重**（不用 shadow git） |

---

## 4. 用户场景

### 4.1 主流程：跨会话组批提交

```
周一  AI 改登录逻辑
      → 开发者审查 OK
      → stages（保存为 stage-001）

周二  AI 改注册逻辑
      → 开发者审查 OK
      → stages（保存为 stage-002）

周三  AI 改权限逻辑
      → 开发者还在看（stage-003，pending）

开发者决定：stage-001 + stage-002 可以提交
      → stages merge 1 2 --name "auth 模块改造"
      → 在 IDE 中查看合并后的 diff
      → stages commit -m "auth 模块改造"
      → git commit -m "feat: auth module refactor"

stage-003 保持原样，不影响 git
```

### 4.2 辅助流程：单 stage 审查

```
AI 完成一轮修改
  → stages -m "重构了 Button 组件"
  → 在 Cursor 侧边栏 Stages 面板点击 stage
  → 查看 stage(n-1) → stage(n) 的文件级 diff
  → 确认无误，继续下一轮 AI 对话
```

### 4.3 合并后重命名

```
stages merge 1 2 3 --name "用户模块完整改造"
  → stage-001 保留并重命名为「用户模块完整改造」，stage-002/003 被吸收隐藏
  → stages rename 1 "用户模块 v2"  # 也可后续再重命名
```

---

## 5. 功能需求

### 5.1 CLI 命令

#### 5.1.1 `stages` / `stages snap`

保存当前工作区改动为一个新 stage。

```bash
npx stages                    # 保存，自动生成名称
npx stages -m "登录改造"      # 保存并附带描述
npx stages -m登录改造         # -m 与值可粘连
npx stages --message=登录改造 # 长选项
```

**行为：**

- 对比基线：若尚无 stage，则相对 **git HEAD**；若已有 stage，则相对**上一个 stage 的快照**
- 保存范围：工作区所有文件，遵循 `.gitignore` 和 `.stagesignore`（可选）
- 不修改工作区内容
- 不修改 git index
- 输出新 stage 的 ID 和变更摘要（文件数、增删行数）
- 工作区与最新 stage 一致时，输出 `No new changes.` 且不创建空 stage

#### 5.1.2 `stages list`

列出所有 stage 及其状态。

```bash
npx stages list
```

**输出示例：**

```
ID        名称              状态      时间                  文件
stage-001 auth 模块改造      pending   2026-07-08 14:30     8 files (+200/-40)
stage-003 权限改造          pending   2026-07-10 11:00     4 files (+50/-5)
```

> 合并后 list 只显示保留的第一个 stage（已重命名），被吸收的 stage 标记为 `merged` 且默认隐藏。使用 `list --all` 可查看历史。

**状态枚举：**

| 状态 | 含义 |
|------|------|
| `pending` | 已保存，未提交（含合并后的 stage） |
| `merged` | 已被合并吸收到其他 stage，默认不在 list 中显示 |
| `ready` | 保留兼容，语义同 `pending` |
| `committed` | 已通过 `stages commit` 应用到工作区并标记完成 |

#### 5.1.3 `stages show <id>`

查看 stage 或 commit 的 diff。

**Stage：**

```bash
npx stages show 1              # 当前 cycle 的 stage-001（数字简写）
npx stages show stage-001      # 完整 ID
npx stages show 2 --open       # 调起 VS Code/Cursor diff 视图
npx stages show 1 --stat       # 仅显示文件统计
```

**Commit：**

```bash
npx stages show commit-001     # 相邻 commit 之间的增量 diff
npx stages show c1             # c 前缀简写
npx stages show c001 --stat    # commit 支持 --stat
```

**Stage diff 语义：**

- 普通 stage：`diff(stage(n-1), stage(n))`
- 合并后的 stage：`diff(合并前最后一个原始 stage 的父级, merged stage)` 或 `diff(baseline, merged stage)` —— 见 §7.2
- 第一个 stage（相对 git HEAD）：`diff(git HEAD, stage-001)`
- 数字简写（如 `1`）仅匹配**当前 cycle** 的 stage；历史 stage 需用 `stage-001` 或 `list --all` 确认

**Commit diff 语义：**

- `commit-001`：`diff(git HEAD, commit-001 快照)`
- `commit-00N`（N > 1）：`diff(commit-00(N-1), commit-00N)`，仅显示相邻 commit 之间的增量
- commit show 支持 `--stat`，暂不支持 `--open`

#### 5.1.4 `stages merge <id...> --name <name>`

合并多个连续的、未提交的 stage。

```bash
npx stages merge 1 2 --name "auth 模块改造"
npx stages merge 2 3 4 --name "用户模块"
```

**规则：**

- 仅允许合并 **ID 连续** 的 stage（如 1+2、2+3、1+2+3）
- 不允许跳号合并（如 1+3，即使都未提交）
- **就地合并**：保留第一个 stage 的 ID，将其重命名为 `--name` 指定的名称
- 取最后一个 stage 的 manifest 作为合并后的快照内容
- 其余被吸收的 stage 标记为 `merged` 并隐藏，不再出现在默认 list 中
- 后续 stage 的 `prev` 指针自动重定向到保留的 stage
- 必须通过 `--name` 指定合并后的名称

**错误处理：**

- 包含已提交 stage → 报错拒绝
- 包含已合并（`merged` 状态）的 stage → 报错拒绝
- 不连续 → 报错拒绝

#### 5.1.5 `stages rename <id> <new-name>`

重命名 stage。

```bash
npx stages rename stage-auth "auth 模块 v2"
```

**规则：**

- 未提交的 stage（`pending` / `ready`）可重命名
- 已提交（`committed`）的不可重命名

#### 5.1.6 `stages commit -m <message>`

将当前 cycle 的所有 stage 合并提交为一个 **commit 节点**，并应用到工作区。

```bash
npx stages commit -m "auth 模块改造"
npx stages commit -m "auth 模块改造" --force
```

**行为：**

1. 自动取当前 cycle 中**最新 active stage** 的快照（已包含本 cycle 所有 stage 的累计改动）
2. 将累计 diff 应用到工作区
3. 创建 `commit-001` 节点（可用 `stages log` 查看历史）
4. 本 cycle 所有 stage（含 `merged`）归档到该 commit，默认 list 不可见（`list --all` 可查看）
5. **stage ID 重置**，下次 `stages` 从 `stage-001` 重新计数
6. **baseline 更新**为该 commit 的快照（后续 diff 相对此 baseline，不依赖 git commit）

**注意：**

- 必须提供 `-m` 命名
- 不需要指定 stage ID
- 不自动执行 `git commit`；应用后用户自行 `git add` + `git commit`
- 工作区有**未 stage** 的改动时：
  - 默认：列出脏文件并退出（exit 1），提示先 `stages -m` 保存或加 `--force`
  - `--force`：跳过检测，**直接用最新 stage 快照覆盖工作区**；未 stage 的改动将丢失

#### 5.1.7 `stages log`

查看 commit 历史（当前 cycle 的 stage 不在此列出，用 `stages list`）。具体改动用 `stages show commit-001` 或 `stages show c1` 查看。

```bash
npx stages log
```

#### 5.1.8 `stages verify`

构建前门禁：检查所有 stage 已 commit 且工作区无未 stage 改动。

```bash
npx stages verify
# 可写入 package.json: "build": "stages verify && ..."
```

| 情况 | 行为 |
|------|------|
| 未 init | 跳过，提示 |
| 无 stage 且无 commit 历史 | 跳过 |
| 当前 cycle 有未 commit 的 stage | 报错退出码 1 |
| 工作区有未 stage 改动 | 报错退出码 1 |
| 全部已 commit 且工作区干净 | 通过 |

#### 5.1.9 `stages hide <id>` / `stages unhide <id>`

隐藏或恢复已提交的 stage（不删除数据，仅从列表中隐藏）。

```bash
npx stages hide stage-001             # 从 list / 扩展面板中隐藏
npx stages unhide stage-001           # 恢复显示
npx stages list --all                 # 包含已隐藏的 stage
```

**规则：**

- 仅 `committed` 状态的 stage 可隐藏
- 隐藏只影响展示，快照数据仍保留在 `.stages/`
- 扩展面板默认不显示已隐藏 stage，可通过设置或 `--all` 查看

#### 5.1.10 `stages drop <id>`

删除当前 cycle 中序号 **≥ N** 的所有 stage，并将工作区恢复到删除前的有效快照。

```bash
npx stages drop 5              # 删除 stage-005，工作区恢复到 stage-004
npx stages drop 3              # 删除 stage-003、004、005，工作区恢复到 stage-002
npx stages drop 3 --yes        # 跳过交互确认
npx stages drop 3 --force      # 强制覆盖工作区未 stage 改动
```

**规则：**

- **仅未 commit 的 stage**：只匹配当前 cycle 中 `pending` / `ready` 且无 `commitId` 的 stage；已 commit 的历史同名 stage 不会被匹配
- 按 **stage ID 序号**截断：`drop N` 删除所有序号 ≥ N 的当前 cycle 未 commit stage（含 ID 空洞，如 drop 4 会同时删 stage-004 与 stage-006）
- **不重编号** ID；`nextId` 不回收（删 stage-005 后下次 snap 仍为 stage-006）
- 工作区恢复到序号 < N 的最大 pending/ready stage；`drop 1` 且无更早 stage 时恢复到 **cycle baseline**
- 序号范围内 `merged` 状态的 hidden stage **一并删除**元数据
- 删除 meta 条目时按 `id + createdAt` 精确匹配，不误删历史同名 stage
- 允许 `drop 1` 清空当前 cycle
- 执行前需用户确认（CLI `[y/N]`；扩展确认对话框）；`--yes` 跳过 CLI 确认
- 工作区有未 stage 改动：默认拒绝并列出文件；`--force` 强制覆盖（与 `commit` 一致）
- MVP 不清理 orphan blob

完整规格见 [features/stage-drop.md](./features/stage-drop.md)。

**错误处理：**

- 当前 cycle 无指定 ID 的未 commit stage → `DROP_STAGE_NOT_FOUND`（`No uncommitted stage with id stage-00N exists.`）
- 目标 status 非 pending/ready → `DROP_INVALID_STATUS`
- 工作区有未 stage 改动 → 列出文件，提示 `--force`
- 用户取消确认 → 不修改数据

#### 5.1.11 `stages init`

初始化当前项目的 stages 存储。

```bash
npx stages init
```

**行为：**

- 创建 `.stages/` 目录及初始 `meta.json`
- 将 `.stages/` 写入 `.gitignore`（若尚未存在）
- 记录当前 git HEAD 作为 baseline
- 若工作区相对 HEAD 有改动，**自动创建第一个 stage**（仅统计实际变更文件）
- 若工作区与 HEAD 一致，不创建 stage
- 若已初始化，提示已存在并跳过

> 首次执行 `stages` 时若未初始化，会自动执行等效于 `stages init` 的操作。

#### 5.1.12 `stages status`

显示当前项目 stages 概况。

```bash
npx stages status
```

### 5.2 VS Code / Cursor 扩展

#### 5.2.1 Stages 侧边栏

在 Source Control 面板注册 **Stages SCM Provider**，显示：

- **Unstaged Changes**（最上方，有改动时显示）：工作区相对最新 stage 的未 stage 改动，**默认展开**文件列表
- **当前 cycle** 的 stage 列表（**新 → 旧**）
- **commit 历史**（`stages log`，新 → 旧）
- stage / commit 分组默认只显示标题；点击 **Show Files** 加载文件列表，**Hide Files** 收起
- stage / commit 展开状态**仅当前会话有效**，重开 IDE 后全部收起，需重新点击
- 分组顺序固定：**Unstaged → stage（新→旧）→ commit（新→旧）**；新增项刷新后自动排到正确位置

**技术说明：** VS Code SCM `ResourceGroup` 无法监听原生折叠事件，因此通过 `Show Files` / `Hide Files` 命令显式控制文件列表。分组显示顺序由创建顺序决定，刷新时若顺序变化会重建分组以保证排序。

**Unstaged 参照基线：**

| 场景 | 左侧（旧） | 右侧（新） |
|------|-----------|-----------|
| 有 active stage | 最新 stage 快照 | 工作区文件 |
| 无 active stage（新 cycle） | baseline / 上一 commit 快照 | 工作区文件 |

#### 5.2.2 Diff 查看（Stage）

- 点击文件 → 打开 `vscode.diff` 左右对比
- 左侧：上一 stage（或 git HEAD）的文件内容
- 右侧：当前 stage 的文件内容
- 使用虚拟文件 URI：`stages://<stage-id>/<file-path>`

#### 5.2.3 基础操作（MVP）

| 操作 | 触发方式 |
|------|----------|
| 查看 unstaged diff | 直接点击 Unstaged 下文件（默认展开） |
| 查看 stage / commit diff | Show Files 后点击文件 |
| 展开 stage / commit 文件列表 | 分组旁 **Show Files**；**Hide Files** 收起（仅当前会话记忆） |
| 刷新列表 | 视图标题栏 Refresh / 监听 meta.json / 工作区文件编辑 |
| 重命名 stage | 右键 stage 分组 → Rename（仅 pending / ready） |
| 删除 stage | 右键 stage 分组 → Drop stage…（仅 pending / ready；含确认对话框） |

#### 5.2.4 扩展不做（MVP）

- 在扩展内执行 merge / commit（通过 CLI 完成）
- 按行采纳/拒绝
- 与 Git 面板联动
- commit 重命名 / 隐藏 / 删除

#### 5.2.5 Commit 历史展示（P5-10，待实现）

扩展需与 CLI `stages log` / `stages show commit-001` 对齐，在 SCM 面板展示 commit 记录。

**面板布局（已确认 E1）：**

```
Source Control: Stages
├── stage-001  登录改造 [pending]      ← 当前 cycle（在上）
├── stage-002  注册改造 [ready]
├── commit-002  权限模块 [commit]        ← 历史 commit（在下），newest first
└── commit-001  auth 模块改造 [commit]
```

**Commit Group 标题格式（已确认 E3）：**

`{序号} {name} [commit]`，例如 `1 auth 模块改造 [commit]` — **不**显示包含的 stageIds

**Commit diff 语义（与 CLI 一致，已确认）：**

| Commit | 左侧 | 右侧 |
|--------|------|------|
| `commit-001` | git HEAD（`meta.baseline`） | commit-001 快照 |
| `commit-00N`（N > 1） | commit-00(N-1) 快照 | commit-00N 快照 |

**数据来源：**

- 列表：`api.log(projectRoot)`
- 文件变更：`api.show(projectRoot, commitId)`
- 文件内容：扩展 ContentProvider 需支持 `stages://commit-001/<path>` 读取 commit manifest（Core 需新增 `readCommitFile` / `getPrevCommitId`，或等价 API）

**已确认决策：**

| # | 决策项 | 结果 |
|---|--------|------|
| E1 | commit 与 stage 排列 | 当前 cycle stage 在上，commit 历史在下 |
| E2 | commit 排序 | 新 → 旧（与 `stages log` 一致） |
| E3 | commit 标题是否显示 stageIds | 否，仅 `{序号} {name} [commit]` |
| E4 | commit 与 `showHidden` 关系 | commit 承担历史审查；`showHidden` 仍仅控制已归档 stage |
| E5 | 视觉分隔 | 不需要，`[commit]` 标签即可区分 |

### 5.3 存储

#### 5.3.1 目录结构

```
<project-root>/
  .stages/
    meta.json           # stage 列表、状态、合并关系
    snapshots/
      stage-001/        # 完整文件快照
        src/
          auth/
            login.ts
      stage-002/
      ...
    blobs/              # 可选：内容寻址去重
```

#### 5.3.2 独立存储原则

- 所有数据存放在 `.stages/` 目录
- 不使用 git index、不创建隐藏 git 分支
- `.stages/` 应加入 `.gitignore`（初始化时自动添加）

#### 5.3.3 meta.json 结构（草案）

```json
{
  "version": 1,
  "baseline": "abc1234",
  "stages": [
    {
      "id": "stage-001",
      "name": "登录改造",
      "status": "merged",
      "parent": null,
      "prev": null,
      "snapshot": "snapshots/stage-001",
      "createdAt": "2026-07-08T14:30:00Z",
      "mergedInto": "stage-auth",
      "hidden": false,
      "stats": { "files": 5, "additions": 120, "deletions": 30 }
    },
    {
      "id": "stage-auth",
      "name": "auth 模块改造",
      "status": "ready",
      "parent": "stage-002",
      "prev": null,
      "snapshot": "snapshots/stage-auth",
      "mergedFrom": ["stage-001", "stage-002"],
      "createdAt": "2026-07-10T09:00:00Z",
      "stats": { "files": 8, "additions": 200, "deletions": 40 }
    }
  ]
}
```

---

## 6. 与 Git 的边界

```
┌─────────────────────────────────────────────┐
│  Stages 层（独立存储 .stages/）              │
│  stage-001 → stage-002 → merge → commit     │
└──────────────────┬──────────────────────────┘
                   │ stages commit（应用 diff）
                   ▼
┌─────────────────────────────────────────────┐
│  Git 工作区（working directory）             │
│  git add → git commit                       │
└─────────────────────────────────────────────┘
```

| 操作 | 影响 git index | 影响 working tree | 影响 git history |
|------|---------------|-------------------|-----------------|
| `stages` | 否 | 否 | 否 |
| `stages show` | 否 | 否 | 否 |
| `stages merge` | 否 | 否 | 否 |
| `stages commit` | 否 | **是** | 否 |
| 用户 `git commit` | 是 | 否 | 是 |

**前提条件：** 项目必须是一个 git 仓库（用于确定 baseline = HEAD）。

---

## 7. Diff 计算规则

### 7.1 单 stage 增量 diff

```
stage-001: diff(git HEAD, snapshot-001)
stage-002: diff(snapshot-001, snapshot-002)
stage-003: diff(snapshot-002, snapshot-003)
```

### 7.2 合并 stage diff

合并 stage-001（由 stage-001 + stage-002 就地合并并重命名）：

```
stage-001 的 show diff: diff(git HEAD, snapshot-001)  # 累计 diff
stage-001 的 commit diff: diff(git HEAD, snapshot-001)
```

- **show / IDE 查看**：对已合并的 stage 显示相对 git HEAD 的**累计 diff**
- **commit**：将合并后快照相对 git HEAD 的全部改动应用到工作区
- **合并实现**：取最后一个被合并 stage 的 manifest 写入第一个 stage，不生成新 ID

### 7.3 文件变更类型

| 类型 | diff 左侧 | diff 右侧 |
|------|----------|----------|
| 新增 | 空 / `/dev/null` | stage 中的文件内容 |
| 修改 | 上一版本的文件内容 | 当前 stage 的文件内容 |
| 删除 | 上一版本的文件内容 | 空 / `/dev/null` |

---

## 8. 非功能需求

| 类别 | 要求 |
|------|------|
| 性能 | 单次 `stages` 保存 < 2s（100 个文件以内） |
| 存储 | 支持内容寻址去重，避免重复存储未变文件 |
| 兼容 | Node.js >= 18，VS Code >= 1.85，Cursor 兼容 |
| 安装 | `npx stages` 或 `npm install -g stages` |
| 安全 | 不收集/上传任何数据，纯本地运行 |

---

## 9. MVP 范围

### 9.1 包含

- [x] CLI：`stages`、`init`、`list`、`show`、`merge`、`rename`、`commit`、`hide`、`status`
- [x] 独立 `.stages/` 存储
- [x] 增量 diff 计算
- [x] 连续 stage 合并 + 重命名
- [x] VS Code/Cursor 扩展：侧边栏列表 + 文件级 diff 查看
- [x] `stages show --open` 调起编辑器 diff

### 9.2 不包含（后续迭代）

- [ ] 按文件 / 按行选择性采纳
- [ ] `stages revert`（回滚到某个 stage 状态）
- [ ] 删除 / 废弃 stage
- [ ] AI agent 集成（自动 stages）
- [ ] 与 ckpt 互操作
- [ ] 多项目管理
- [ ] `.stagesignore` 自定义忽略规则

---

## 10. 项目结构（建议）

```
stages/
├── packages/
│   ├── cli/                 # CLI 入口，npx stages
│   ├── core/                # 核心逻辑：存储、diff、merge
│   └── vscode-extension/    # VS Code / Cursor 扩展
├── docs/
│   └── requirements.md      # 本文档
├── package.json             # monorepo 根
└── README.md
```

**技术栈建议：**

| 层 | 技术 |
|----|------|
| CLI | Node.js + TypeScript + commander |
| Core | TypeScript，文件快照 + diff（可选 libgit2 / 自研） |
| Extension | VS Code Extension API + 虚拟 FS |
| 打包 | pnpm workspace / turborepo |

---

## 11. 补充决策（已确认）

| # | 问题 | 确认结果 |
|---|------|----------|
| T1 | 合并时快照策略 | 物理生成新快照（累计状态） |
| T2 | `stages commit` 后原 stage 如何处理 | 标记 `committed`，保留历史；用户可通过 `stages hide` 隐藏 |
| T3 | 工作区有脏改动时执行 `stages commit` | 警告并需 `--force` 确认；`--force` 用最新 stage 快照覆盖未 stage 改动 |
| T4 | stage ID 格式 | 自动递增：`stage-001`、`stage-002` |
| T5 | 是否支持 `stages init` 初始化 | 支持；首次 `stages` 也可自动初始化 |
| T6 | 存储方案 | 文件快照 + 内容寻址 blob 去重（不用 shadow git） |

---

## 12. 验收标准

### 12.1 CLI

- [ ] 在 git 仓库中执行 `npx stages`，生成 stage-001，不改变 git status
- [ ] 多次 `stages` 后 `stages list` 显示所有 stage 及状态
- [ ] `stages show 2` 仅显示 stage1 → stage2 的增量 diff
- [ ] `stages show 1` 数字简写匹配当前 cycle 的 stage
- [ ] `stages show commit-001` / `stages show c1` 显示相邻 commit 之间的增量 diff
- [ ] commit show 支持 `--stat`，不支持 `--open`
- [ ] `stages merge 1 2 --name "xxx"` 成功合并，list 只显示重命名后的 stage-001
- [ ] 尝试合并非连续 stage 报错
- [ ] 尝试合并已提交 stage 报错
- [ ] `stages rename` 可修改未提交 stage 名称
- [ ] `stages commit -m` 将改动应用到工作区，stage 标记为 committed
- [ ] 工作区有未 stage 改动时 `stages commit` 警告，需 `--force` 才继续；`--force` 覆盖未 stage 改动
- [ ] `stages -m` 与 `stages commit -m` 均可正常使用（无 Commander 选项冲突）
- [ ] 工作区无新改动时 `stages -m` 提示 `No new changes.`
- [ ] `stages hide` 可隐藏已提交 stage，`list --all` 可查看
- [ ] `stages init` 可初始化，首次 `stages` 自动初始化
- [ ] 应用后用户可正常 `git add` + `git commit`

### 12.2 VS Code / Cursor 扩展

- [ ] 侧边栏显示当前 cycle stage 列表（新 → 旧）
- [ ] 侧边栏显示 commit 历史（`stages log`）
- [ ] 有未 stage 改动时显示 Unstaged Changes 分组（最上方，默认展开）
- [ ] stage / commit 默认折叠，展开后显示 Loading 再显示文件列表
- [ ] 点击 unstaged 文件打开 diff（左 = 最新 stage，右 = 工作区）
- [ ] 点击 commit 文件打开 diff（语义同 `stages show commit-001`）
- [ ] `commit-001` 左侧为 git HEAD；`commit-00N` 左侧为上一 commit
- [ ] CLI 新增 stage / commit 后扩展列表自动刷新
- [ ] commit 为只读（无 Rename 菜单）
- [ ] 扩展在 Cursor 中正常运行

---

## 13. 术语表

| 术语 | 定义 |
|------|------|
| **stage** | 一次手动保存的代码改动快照 |
| **baseline** | 第一个 stage 的对比基线，即 git HEAD |
| **增量 diff** | 相邻两个 stage 之间的文件差异 |
| **累计 diff** | 某 stage 相对 git HEAD 的全部差异 |
| **merge** | 将多个连续未提交 stage 就地合并为第一个 stage 并重命名 |
| **commit**（stages 语义） | 将 stage 的累计 diff 应用到工作区，非 git commit |
