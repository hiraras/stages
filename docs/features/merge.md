# 合并 stage 流程细则

> 状态：已确认  
> 总纲：[business-flow.md](../business-flow.md) · `merge`  
> 关联：[requirements.md](../requirements.md) §3#5–6、§3.1 · [system-design.md](../system-design.md)

## 1. 范围与动机

将**当前 cycle** 内多个已确认、连续的未提交 stage 收成一个，便于命名审查与一次 commit。

## 2. 对外形式

```bash
stages merge 1 2 --name "auth 模块改造"
stages merge 2 3 4 --name "用户模块"
```

`--name` **必填**。

## 3. 语义与规则

1. **仅当前 cycle**；ID 数字简写同 [show](./show.md)。
2. 仅 `pending` / `ready`；**不得**含 `committed` 或已被吸收的 `merged`。
3. ID 必须**连续**（如 1+2、2+3+4）；禁止跳号（1+3）。
4. **就地合并：** 保留**第一个** stage 的 ID；写入**最后一个** stage 的 manifest；名称改为 `--name`。
5. 其余标记 `merged` 并默认隐藏；其后 stage 的 `prev` **重指向**保留的 stage。
6. **不**改工作区、**不**改 git index。

## 4. 与其它流程的关系

- 之后可 [rename](./rename.md)、[show](./show.md)、[commit](./commit.md)。
- 列表可见性见 [list-status](./list-status.md)。

## 5. 模块衔接

| 层级 | 职责 |
|------|------|
| Core | 校验、manifest 就地更新、prev 修复、状态 |
| CLI | 参数与错误信息 |
| 扩展 | MVP **不**提供 merge（走 CLI） |

## 6. 数据 / 存储（仅本流程）

更新保留 stage 的名称/快照指针；改被吸收 stage 状态；修正链表。

## 7. 错误与边界

| 场景 | 行为 |
|------|------|
| 含已提交 | 拒绝 |
| 含 merged | 拒绝 |
| 不连续 | 拒绝 |
| 缺少 `--name` | 拒绝 |
| 非当前 cycle | 拒绝（同 ID 作用域） |

## 8. 验收要点

- 成功后默认 list 只见改名后的首 ID
- 就地策略：无新 ID；快照内容等于合并前最后一个
- 非法合并均报错且不改 meta

## 9. 非目标 / 后续

- 非连续「拣选合并」；生成全新 ID 的合并模式。
