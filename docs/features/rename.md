# 重命名 流程细则

> 状态：已确认  
> 总纲：[business-flow.md](../business-flow.md) · `rename`  
> 关联：[requirements.md](../requirements.md) §5.1、§5.2 · [system-design.md](../system-design.md)

## 1. 范围与动机

为**当前 cycle** 未提交 stage 设置可读业务名称，不影响快照内容。

## 2. 对外形式

```bash
stages rename <id> <new-name>
```

扩展：对 pending / ready 的 stage 分组右键 → Rename。

## 3. 语义与规则

1. **作用域：当前 cycle**（§3.1）；数字简写仅当前 cycle。
2. 仅 `pending` / `ready` 可改名。
3. `committed` / 已归档历史：**不可**重命名。
4. 只改显示名称，不改 ID、不改 manifest、不改工作区。

## 4. 与其它流程的关系

- 常接在 [merge](./merge.md) 之后；[ide-scm](./ide-scm.md) 提供 UI 入口。

## 5. 模块衔接

| 层级 | 职责 |
|------|------|
| Core | 校验状态并更新 name |
| CLI | 参数解析 |
| 扩展 | 输入框 + 调用 Core |

## 6. 数据 / 存储（仅本流程）

更新 meta 中对应 stage 的 `name`（按当前 cycle 条目匹配）。

## 7. 错误与边界

| 场景 | 行为 |
|------|------|
| 目标不存在于当前 cycle | 失败 |
| committed / 非法状态 | 失败 |
| 空名称 | 拒绝（若产品要求非空） |

## 8. 验收要点

- CLI 与扩展均可改名未提交 stage
- committed 无 Rename 入口 / CLI 拒绝

## 9. 非目标 / 后续

- commit 节点重命名（MVP 不做）。
