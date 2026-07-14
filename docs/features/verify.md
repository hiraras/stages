# 构建门禁 流程细则

> 状态：已确认  
> 总纲：[business-flow.md](../business-flow.md) · `verify`  
> 关联：[requirements.md](../requirements.md) §5.1 · [system-design.md](../system-design.md)

## 1. 范围与动机

在构建或发布前确认：**当前 cycle 无未 commit stage**，且工作区无未 stage 改动，避免带着未归档篮子发版。

## 2. 对外形式

```bash
stages verify
# 例: "build": "stages verify && ..."
```

## 3. 语义与规则

| 情况 | 行为 |
|------|------|
| 未 init | **跳过**，提示 |
| 无 stage 且无 commit 历史 | **跳过** |
| 当前 cycle 有未 commit 的 stage | **失败**，退出码 1 |
| 工作区有未 stage 改动 | **失败**，退出码 1 |
| 全部已 commit 且工作区干净 | **通过**，退出码 0 |

**作用域：** 检查当前 cycle + 工作区相对最新参照的脏状态；不修改数据。

## 4. 与其它流程的关系

- 失败时用户通常先 [snap](./snap.md) 或 [commit](./commit.md) / 清理工作区。

## 5. 模块衔接

| 层级 | 职责 |
|------|------|
| Core | 状态判定 |
| CLI | 退出码与提示 |
| 扩展 | MVP 可不集成 |

## 6. 数据 / 存储（仅本流程）

只读。

## 7. 错误与边界

见 §3 表；跳过与失败须可被脚本区分（跳过宜 exit 0 + 文案，失败 exit 1）。

## 8. 验收要点

- 有 pending stage 时 verify 失败
- 仅有未 stage 脏文件时失败
- 未 init 不导致硬失败（跳过）

## 9. 非目标 / 后续

- 与 CI 云端策略集成；自动 commit。
