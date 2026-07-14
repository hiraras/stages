# Commit 历史 流程细则

> 状态：已确认  
> 总纲：[business-flow.md](../business-flow.md) · `log`  
> 关联：[requirements.md](../requirements.md) §3.1、§5.1 · [system-design.md](../system-design.md)

## 1. 范围与动机

只读列出 **stages commit** 历史，与当前 cycle 的 stage 列表分离（因 stage ID 会重置）。

## 2. 对外形式

```bash
stages log
```

具体文件 diff：`stages show commit-001` / `stages show c1`（见 [show](./show.md)）。

## 3. 语义与规则

1. **只列 commit 节点**（新 → 旧）；**不**列出当前 cycle 的 stage。
2. 当前 cycle stage 用 [list-status](./list-status.md) / [ide-scm](./ide-scm.md)。
3. 标题信息不强制展示所含 stageIds（与扩展 E3 对齐：可不显示）。

**作用域：** 全局 commit 历史；与「当前 cycle stage」正交。

## 4. 与其它流程的关系

- 条目由 [commit](./commit.md) 产生；详情 [show](./show.md)；侧栏 [ide-scm](./ide-scm.md)。

## 5. 模块衔接

| 层级 | 职责 |
|------|------|
| Core | 枚举 commit |
| CLI | 格式化输出 |
| 扩展 | SCM 下方 commit 分组数据 |

## 6. 数据 / 存储（仅本流程）

只读 commit 列表。

## 7. 错误与边界

| 场景 | 行为 |
|------|------|
| 未 init / 无 commit | 空列表或提示 |

## 8. 验收要点

- log 中无当前 cycle stage 行
- 顺序新 → 旧；与扩展 commit 区一致

## 9. 非目标 / 后续

- commit 删除/改名；分页 UI（若日志极长再定）。
