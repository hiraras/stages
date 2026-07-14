# 列表与概况 流程细则

> 状态：已确认  
> 总纲：[business-flow.md](../business-flow.md) · `list-status`  
> 关联：[requirements.md](../requirements.md) §3.1、§5.1 · [system-design.md](../system-design.md)

## 1. 范围与动机

只读查看 **当前 cycle** 的 stage 状态，以及项目 stages 概况；可选查看含历史在内的全量元数据。

## 2. 对外形式

```bash
stages list
stages list --all
stages status
```

**list 输出字段（示例）：** ID、名称、状态、时间、文件变更摘要。

## 3. 语义与规则

1. **默认 `list`：当前 cycle 可见 stage**（`pending` / `ready`）；`merged` **默认隐藏**；展示顺序 **新 → 旧**（按 `createdAt`）。
2. **`list --all`：** 可含 merged、已归档到 commit 的历史 stage 元数据等（实现须标明来源 cycle/commit，避免同名 ID 误解）；同样 **新 → 旧**。
3. **`status`：** 项目概况（是否 init、当前 cycle stage 数量、是否有未 stage 改动、最近 commit 等——具体字段见设计）。
4. 状态枚举：`pending` | `merged` | `ready`（同 pending）| `committed`。

**作用域：** 默认以当前 cycle 为主；`--all` 放宽只读范围，仍不修改数据。

## 4. 与其它流程的关系

- 展示结果受 [merge](./merge.md)、[commit](./commit.md)、[drop](./drop.md) 影响。
- 与 [ide-scm](./ide-scm.md) 列表信息对齐（扩展侧栏）。

## 5. 模块衔接

| 层级 | 职责 |
|------|------|
| Core | 查询 meta、过滤可见性、概况汇总 |
| CLI | 表格/文本输出 |
| 扩展 | SCM 分组数据源（类似 list，非本命令） |

## 6. 数据 / 存储（仅本流程）

只读 meta / 工作区探测；无写入。

## 7. 错误与边界

| 场景 | 行为 |
|------|------|
| 未 init | 提示并失败或空概况（与 CLI 统一，见设计） |
| 无 stage | 空列表 / 概况标明无 active stage |

## 8. 验收要点

- merge 后默认 list 只见保留 stage；`--all` 可见 merged
- commit 后默认 list 不展示已归档 stage；`--all` 可查看
- 默认输出为 **新 → 旧**
- status 反映当前 cycle 概况

## 9. 非目标 / 后续

- 不做交互式 TUI 筛选；多项目聚合不在 MVP。
