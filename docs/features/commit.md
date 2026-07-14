# 提交到工作区 流程细则

> 状态：已确认  
> 总纲：[business-flow.md](../business-flow.md) · `commit`  
> 关联：[requirements.md](../requirements.md) §3#3/7/8、§3.1、§5.1 · [system-design.md](../system-design.md)

## 1. 范围与动机

把**当前 cycle** 的累计快照应用到工作区并归档为 stages **commit** 节点，开启新的 cycle（stage ID 重置），但不执行 `git commit`。

## 2. 对外形式

```bash
stages commit -m "auth 模块改造"
stages commit -m "auth 模块改造" --force
```

`-m` **必填**；无需指定 stage ID。

## 3. 语义与规则

1. 取当前 cycle **最新 active** stage 快照（已含本 cycle 累计）。
2. **脏工作区**（相对该快照的未 stage 改动）：默认列出文件并失败；`--force` **用该快照覆盖**工作区（未 stage 改动丢失）。
3. 将快照写入工作区。
4. 创建新的 `commit-00N`；本 cycle **全部** stage（含 `merged`）归档到该 commit（默认 list 不可见）。
5. **stage ID 从 `stage-001` 重新计数**；**baseline 更新为该 commit 快照**（后续 snap/diff 不依赖用户是否已 `git commit`）。
6. **不**修改 git index / git history；不自动 `git commit`。

**作用域：** 归档的是整个当前 cycle；完成后进入新 cycle（§3.1）。

## 4. 与其它流程的关系

- 之后用 [log](./log.md) / [show](./show.md) 审历史；新改动走 [snap](./snap.md)。
- [verify](./verify.md) 要求无未 commit stage。
- 扩展 MVP **不**执行 commit（CLI）。

## 5. 模块衔接

| 层级 | 职责 |
|------|------|
| Core | 脏检测、应用快照、写 commit、归档、重置编号与 baseline |
| CLI | `-m` / `--force`、错误提示 |
| 扩展 | 刷新列表；无 commit 命令（MVP） |

## 6. 数据 / 存储（仅本流程）

新增 commit 节点；stage 打上 commit 关联；更新 baseline / nextId。

## 7. 错误与边界

| 场景 | 行为 |
|------|------|
| 缺少 `-m` | 拒绝 |
| 当前 cycle 无 active stage | 拒绝（或按设计定义） |
| 脏工作区无 `--force` | 失败 exit 1 |
| 用户未做 git commit | **允许**；baseline 已是 stages commit 快照 |

## 8. 验收要点

- 工作区对齐最新 stage；index 未自动 stage
- 归档后 ID 重置；新 snap 为 `stage-001`
- baseline 后续相对该 commit 快照
- `--force` 覆盖未 stage 改动

## 9. 非目标 / 后续

- 自动调用 git commit；部分 stage 提交（非整 cycle）。
