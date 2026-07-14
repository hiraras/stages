# IDE 审查 流程细则

> 状态：已确认  
> 总纲：[business-flow.md](../business-flow.md) · `ide-scm`  
> 关联：[requirements.md](../requirements.md) §3.1、§5.2、§5.5 · [system-design.md](../system-design.md)

## 1. 范围与动机

在 VS Code / Cursor 的 Source Control 中可视化 **Unstaged / 当前 cycle stage / commit 历史**，并打开与 CLI 一致的文件级 diff；提供 Rename / Drop 入口。

## 2. 对外形式

- SCM 视图：**Stages** Provider
- 分组顺序固定：**Unstaged → stage（新→旧）→ commit（新→旧）**
- stage / commit：默认只显示标题；**Show Files** / **Hide Files** 控制文件列表（展开状态仅当前会话）
- 点击文件 → 左右 diff
- 右键未提交 stage：**Rename**、**Drop stage…**
- 刷新：标题栏 Refresh / 监听 meta / 工作区编辑

### Commit 标题（已确认）

`{序号} {name} [commit]`，**不**显示所含 stageIds。

**Commit diff 左侧：** 最老 commit（无 prev）= 初始 git HEAD（`meta.baseline` / `stages://git-head/`）；其后左=上一 commit。勿与 cycle baseline（`stages://baseline/`，用于 Unstaged / 首 stage）混用。

### Unstaged 左右侧

| 场景 | 左（旧） | 右（新） |
|------|---------|---------|
| 有 active stage | 最新 stage 快照 | 工作区 |
| 无 active stage（新 cycle） | cycle baseline / 上一 commit 快照 | 工作区 |

## 3. 语义与规则

1. **Stage 列表 = 当前 cycle**（§3.1）；已归档 stage 默认不在此列。
2. Diff 语义对齐 [show](./show.md) 与需求 §5.5；Unstaged 为工作区相对参照快照。
3. Rename / Drop 规则同 [rename](./rename.md)、[drop](./drop.md)；**committed 只读**。
4. **MVP 不在扩展内**执行 merge / commit。

## 4. 与其它流程的关系

- 只读与有限写操作；组批主路径仍走 CLI [merge](./merge.md)/[commit](./commit.md)。
- 列表与 [list-status](./list-status.md)、[log](./log.md) 对齐。

## 5. 模块衔接

| 层级 | 职责 |
|------|------|
| Core | 提供 list/log/show/drop/rename 等 API |
| 扩展 | SCM Provider、内容提供、命令与确认框 |
| CLI | 无直接依赖；变更后扩展应能刷新 |

虚拟 URI 方案、SCM 分组重建等实现细节见系统设计（本流程不锁源码路径）。

## 6. 数据 / 存储（仅本流程）

Rename/Drop 经 Core 写 meta/工作区；其余只读。

## 7. 错误与边界

| 场景 | 行为 |
|------|------|
| 未 init | 空态/提示初始化 |
| Show Files 加载中 | Loading 再展示 |
| Drop/Rename 失败 | 显示 Core 错误信息 |

## 8. 验收要点

- 三区顺序与排序正确；Unstaged 默认展开
- stage/commit/unstaged diff 正确
- CLI 新增 stage/commit 后可刷新见到
- commit 无 Rename；Drop 仅 pending/ready
- Cursor 可运行

## 9. 非目标 / 后续

- 扩展内 merge/commit；按行采纳；与 Git 面板深度联动；commit 改删。
