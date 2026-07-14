# 丢弃 stage 流程细则

> 状态：已确认（自原 `docs/features/stage-drop.md` 迁入）  
> 总纲：[business-flow.md](../business-flow.md) · `drop`  
> 关联：[requirements.md](../requirements.md) §2.4、§3.1、§3#8/9/12 · [system-design.md](../system-design.md)

## 1. 范围与动机

删除**当前 cycle** 中序号 ≥ N 的未提交 stage，并将工作区恢复到删除前的有效快照，用于撤销不应保留的后续改动。

## 2. 对外形式

```bash
stages drop <id> [--yes] [--force]
```

| 参数 | 说明 |
|------|------|
| `<id>` | 序号，支持 `5` / `stage-005`（与 show、merge 一致） |
| `--yes` / `-y` | 跳过 CLI 交互确认 |
| `--force` | 脏工作区时强制覆盖（同 commit） |

扩展：pending / ready 右键 → **Drop stage…**（确认对话框）。

## 3. 语义与规则

### 3.1 作用域（重要）

- **仅当前 cycle** 中无 `commitId` 的未提交 stage。
- 历史 cycle 已 committed 的同名 `stage-00N` **不会被匹配或删除**。
- 因 commit 后 ID 重置，必须严格按 §3.1 区分 cycle。

### 3.2 基本示例

当前 cycle active：1–5：

| 命令 | 删除 | 保留 | 工作区恢复到 |
|------|------|------|--------------|
| `drop 5` | 5 | 1–4 | stage 4 |
| `drop 3` | 3–5 | 1–2 | stage 2 |
| `drop 1` | 全部 | 无 | **cycle baseline** |

### 3.3 截断与 ID

- `drop N`：删除当前 cycle 内**序号 ≥ N** 的未 commit stage（含范围内 `merged` 元数据）。
- **含 ID 空洞：** 例如仅剩 1–4、6 时 `drop 4` → 删 4 与 6。
- **不重编号**；**不回收** `nextId`（删 5 后下次 snap 仍为 6）。
- 允许 `drop 1` 清空当前 cycle。

### 3.4 工作区与确认

- 恢复目标：序号 &lt; N 的最大 pending/ready manifest；若无 → cycle baseline。
- **脏检测**相对**最新 active stage**（与 `commit` 一致：抓「未 stage」的额外改动）。若相对恢复目标做脏检，在工作区仍等于最新 stage 的常见情况下会永远判脏，导致每次 drop 都要 `--force`，故不采用。
- 默认拒绝脏工作区并列文件；`--force` 覆盖（将工作区写成恢复目标）。
- CLI 默认 `[y/N]`；`--yes` 跳过；扩展用对话框。
- 删除 meta 时按 **`id + createdAt`** 精确匹配。
- MVP **不** GC orphan blob。

## 4. 与其它流程的关系

- 与 [commit](./commit.md) `--force` 对比：commit 用**最新** stage 盖工作区；drop 用**更早** stage/baseline。
- UI 入口见 [ide-scm](./ide-scm.md)；之后可继续 [snap](./snap.md)。

## 5. 模块衔接

| 层级 | 职责 |
|------|------|
| Core | 规划删除集、脏检测、还原工作区、更新 meta |
| CLI | 确认交互、`--yes` / `--force` |
| 扩展 | 确认对话框并调用 Core；committed 无菜单 |

源码路径见系统设计。

## 6. 数据 / 存储（仅本流程）

移除匹配 stage 元数据与对应 manifest 文件；`nextId` 不变；blob 可残留。

## 7. 错误与边界

| 场景 | 错误码 | 处理 |
|------|--------|------|
| 当前 cycle 无该未 commit id | `DROP_STAGE_NOT_FOUND` | `No uncommitted stage with id stage-00N exists.` |
| 目标 status 非 pending/ready | `DROP_INVALID_STATUS` | 说明仅可 drop 未 commit |
| 脏工作区且无 `--force` | `DIRTY_WORKTREE` | 列文件 + 提示 `--force` |
| 用户取消确认 | `DROP_CANCELLED` | 不改数据；CLI 宜 exit 0 |

## 8. 验收要点

- 截断、空洞、跨 cycle 同名 ID、确认与 `--force` 行为符合上文
- 扩展 Drop 与 CLI 一致；committed 不可 drop

## 9. 非目标 / 后续

- `stages gc`；按文件拣选撤销；硬回滚到任意历史 git 状态。
