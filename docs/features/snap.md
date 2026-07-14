# 保存 stage 流程细则

> 状态：已确认  
> 总纲：[business-flow.md](../business-flow.md) · `snap`  
> 关联：[requirements.md](../requirements.md) §3、§5.1 · [system-design.md](../system-design.md)

## 1. 范围与动机

将工作区中已确认的一批改动保存为**当前 cycle** 内新的 stage 快照，供审查与后续合并/提交。

## 2. 对外形式

```bash
stages                    # 保存，自动生成名称
stages snap               # 同上（显式子命令，若实现提供）
stages -m "登录改造"
stages -m登录改造
stages --message=登录改造
```

## 3. 语义与规则

1. **作用域：当前 cycle。** 新 stage ID 在本 cycle 内递增（`stage-001`…）；`stages commit` 后下一 cycle 再从 `001` 计（见 requirements §3.1）。
2. 未初始化 → 先等效 [init](./init.md)。
3. **对比基线：** 当前 cycle 尚无 active stage → 相对 **cycle baseline**；已有 → 相对**上一 active stage** 快照。
4. **范围：** 工作区文件，遵循 `.gitignore` 与可选 **`.stagesignore`**。
5. **不修改** 工作区内容、**不修改** git index。
6. 工作区与最新参照一致 → 输出 `No new changes.`，**不创建**空 stage。
7. 成功 → 创建 `pending` stage，输出 ID 与变更摘要（文件数、增删行等）。

## 4. 与其它流程的关系

- 依赖 [init](./init.md)；审查见 [show](./show.md)、[ide-scm](./ide-scm.md)；列表见 [list-status](./list-status.md)。

## 5. 模块衔接

| 层级 | 职责 |
|------|------|
| Core | 忽略规则、快照写入、blob 去重、meta 追加 |
| CLI | 参数解析（含 `-m` 粘连）、结果打印 |
| 扩展 | 刷新 SCM；不负责 snap（MVP 可由 CLI） |

## 6. 数据 / 存储（仅本流程）

- 新增 stage 条目与对应 manifest/快照；更新 `nextId`（本 cycle）。

## 7. 错误与边界

| 场景 | 行为 |
|------|------|
| 非 git / 未成功 init | 失败 |
| 无新改动 | 提示 `No new changes.`，exit 成功语义（不建 stage） |
| 忽略规则导致无可见改动 | 同「无新改动」 |

## 8. 验收要点

- 生成当前 cycle 的 `stage-00N`，且 `git status`（index）不变
- `.stagesignore` 生效
- `-m` / `--message` / 粘连写法可用
- 无改动不建空 stage

## 9. 非目标 / 后续

- 不自动监听；不按文件/行选择纳入快照。
