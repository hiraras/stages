# Stage Drop 功能规格

> 状态：**已实现**  
> 日期：2026-07-12  
> 关联：[requirements.md](../requirements.md) · [system-design.md](../system-design.md)

---

## 1. 背景与动机

当前 Stages 支持创建（snap）、合并（merge）、提交（commit）、隐藏（hide）stage，但**无法撤销已保存的 stage**。开发者在审查后发现某个 stage 不应保留，或想从中间某个 stage 起丢弃后续改动时，缺少对应操作。

`stages drop` 用于**删除当前 cycle 中序号 ≥ N 的所有 stage**，并将工作区文件恢复到删除前的有效快照状态。

---

## 2. 命令形式

```bash
stages drop <id> [--yes] [--force]
```

| 参数 | 说明 |
|------|------|
| `<id>` | stage 序号，支持 `5` / `stage-005`（与 `show`、`merge` 一致） |
| `--yes` / `-y` | 跳过交互确认 |
| `--force` | 工作区有未 stage 改动时强制覆盖（与 `commit --force` 语义一致） |

---

## 3. 语义

### 3.1 基本示例

假设当前 cycle 有 stage **1、2、3、4、5**（均为 active、未 commit）：

| 命令 | 删除的 stage | 保留的 stage | 工作区恢复目标 |
|------|-------------|-------------|---------------|
| `stages drop 5` | 5 | 1、2、3、4 | **stage 4** 的快照 |
| `stages drop 3` | 3、4、5 | 1、2 | **stage 2** 的快照 |
| `stages drop 1` | 1、2、3、4、5 | （无） | **cycle baseline** |

### 3.2 ID 不重编号 + 按序号截断

**已确认：drop 后不重编号 stage ID，`nextId` 不回收。**

例：

1. 初始 stage 1–5，`drop 5` → 保留 1–4，`nextId` 仍为 6
2. 再次 `stages -m` → 新建 **stage-006**（不是 stage-005）
3. 当前 active：1、2、3、4、6
4. 执行 `stages drop 4` → 删除 **stage-004 和 stage-006**（所有序号 ≥ 4 的 active stage）

**删除集合判定规则：** 解析 stage ID 中的序号 N，删除当前 cycle 内所有 **序号 ≥ N** 的 stage 条目，包括：

- `pending` / `ready` 的 active stage
- 序号落在范围内、状态为 `merged` 的 hidden stage（一并删除元数据）

不因 ID 存在「空洞」而漏删高序号 stage。

### 3.3 核心规则

1. **按序号截断**：`drop N` 删除序号 **≥ N** 的所有当前 cycle stage（含 N）；若 N 等于当前最大序号且只有一个，则只删一个。
2. **工作区还原**：恢复到「序号 < N 的最大 active stage」的 manifest；若无（即 `drop 1`），恢复到 **cycle baseline manifest**。
3. **作用域**：仅当前 cycle；`committed` 归档 stage 不可 drop；不修改 commit 历史。
4. **用户确认**：CLI 默认 `[y/N]` 交互；扩展使用确认对话框；`--yes` 可跳过 CLI 确认。
5. **脏工作区**：相对**恢复目标** manifest 检测未 stage 改动；默认拒绝并列出文件；`--force` 强制覆盖。
6. **允许清空 cycle**：`drop 1` 可删除全部 active stage，之后可继续 `stages -m` 新建 stage。
7. **不 GC blob**：MVP 仅删 meta 条目与 manifest 文件，blob 留待后续 `stages gc`。

### 3.4 CLI 交互示例

```
$ stages drop 3

即将删除以下 stage（3 个）：
  stage-003  权限模块改造
  stage-004  路由调整
  stage-005  临时实验

工作区将恢复到 stage-002「注册逻辑」的快照。
约 12 个文件会被修改/删除/还原。

确认删除？[y/N] y

✓ Dropped stage-003, stage-004, stage-005
  Worktree restored to stage-002
```

### 3.5 ID 空洞示例

```
$ stages list
  stage-006  新改动
  stage-004  路由调整
  stage-003  注册逻辑
  stage-002  登录改造
  stage-001  初始化

$ stages drop 4

即将删除以下 stage（2 个）：
  stage-004  路由调整
  stage-006  新改动

工作区将恢复到 stage-003「注册逻辑」的快照。

确认删除？[y/N] y

✓ Dropped stage-004, stage-006
  Worktree restored to stage-003
```

---

## 4. 技术方案

### 4.1 模块

| 层级 | 位置 | 职责 |
|------|------|------|
| Core | `src/core/stage/drop.ts` | 校验、计算删除范围、还原工作区、更新 meta |
| CLI | `src/cli/commands/drop.ts` | 参数解析、交互确认、`--yes` / `--force` |
| 扩展 | `extension/src/commands/drop.ts` | 右键 Drop stage… + 确认对话框 |
| API | `src/core/index.ts` | 暴露 `drop(projectRoot, id, opts?)` |

### 4.2 算法

```
输入：id = stage-N

1. 解析 id → 序号 N，校验 stage 存在于当前 cycle
2. 取当前 cycle 全部 stage 条目（含 merged hidden）
3. 删除集合 = { stage | 序号(stage) ≥ N }
   - 校验：删除集合中不能有 committed 条目（若有则 DROP_INVALID_STATUS）
4. 恢复目标：
   - activeRestore = max { stage | 序号(stage) < N 且 status ∈ {pending, ready} }
   - 若 activeRestore 存在 → 取其 manifest
   - 否则 → getBaselineManifest(projectRoot)
5. 脏工作区检测（相对恢复目标 manifest）；未 --force 则拒绝
6. 用户确认（CLI 交互 / 扩展对话框 / --yes 跳过）
7. 应用恢复目标 manifest 到工作区
8. 从 meta.stages 移除删除集合中的全部条目
9. nextId 不变（不回收）
10. 删除对应 manifests/*.json；不清理 blob
```

### 4.3 错误码

| 场景 | 错误码 | 处理 |
|------|--------|------|
| stage 不存在 | `STAGE_NOT_FOUND` | 列出可用 ID |
| 已 committed / 非当前 cycle | `DROP_INVALID_STATUS` | 说明不可 drop |
| 脏工作区且未 `--force` | `DIRTY_WORKTREE` | 列出文件 + 提示 `--force` |
| 用户取消确认 | `DROP_CANCELLED` | 不修改数据，exit 0 |

### 4.4 与现有命令的关系

| 命令 | 对比 |
|------|------|
| `hide` | 仅隐藏展示，不删数据，不改工作区 |
| `drop` | **物理删除** stage 元数据与 manifest，**并还原工作区** |
| `commit --force` | 用最新 stage 覆盖工作区；drop 是用更早 stage / baseline 覆盖 |

### 4.5 扩展交互（已确认同步实现）

- 右键 pending / ready stage → **Drop stage…**
- 对话框展示：将删除的 stage 列表（含同序号范围内所有 stage）、恢复目标
- 确认后调用 Core `drop()` API，刷新 SCM 面板
- committed stage 不显示 Drop 菜单项

---

## 5. 已确认决策摘要

| # | 问题 | 决策 |
|---|------|------|
| Q1 | 可 drop 范围 | 仅当前 cycle 的 pending / ready active stage；committed 不可 drop |
| Q2 | ID 处理 | 不重编号；nextId 不回收；按序号 ≥ N 删除（含 ID 空洞后的高序号 stage） |
| Q3 | 脏工作区 | 与 commit 一致：默认拒绝，`--force` 覆盖 |
| Q4 | drop 1 恢复目标 | cycle baseline manifest |
| Q5 | 清空 cycle | 允许 |
| Q6 | 确认方式 | 默认 `[y/N]`；`--yes` 跳过 |
| Q7 | 扩展 | CLI + 扩展右键 Drop（含确认对话框） |
| Q8 | merged stage | 序号在范围内的一并删除元数据 |
| Q9 | blob GC | MVP 不 GC |

---

## 6. 实现清单

- [x] 规格确认（本文档）
- [x] `requirements.md` §5.1.10
- [x] `system-design.md` §7 / §8 / §11
- [x] `README.md` 命令参考表
- [x] Core：`drop.ts` + 单元/集成测试
- [x] CLI：`stages drop`
- [x] 扩展：右键 Drop + 确认对话框

---

## 7. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-12 | 初稿：语义、算法、待确认问题 |
| 2026-07-12 | 全部决策已确认；补充 ID 空洞截断规则与扩展示例 |
