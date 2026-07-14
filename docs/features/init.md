# 初始化 流程细则

> 状态：已确认  
> 总纲：[business-flow.md](../business-flow.md) · `init`  
> 关联：[requirements.md](../requirements.md) §3#10、§5.1 · [system-design.md](../system-design.md)

## 1. 范围与动机

在项目内建立独立于 git index 的 Stages 存储与初始 baseline，使后续 snap 等流程可运行。

## 2. 对外形式

```bash
stages init
```

首次执行 `stages`（snap）且未初始化时，自动执行**等效于** `stages init` 的操作。

## 3. 语义与规则

1. 项目必须是 **git 仓库**（用于读取 HEAD）。
2. 创建 `.stages/` 与初始 `meta.json`（字段见系统设计）。
3. 若 `.gitignore` 尚无 `.stages/`，则追加写入。
4. 记录当前 **git HEAD** 为初始 baseline（及原始 HEAD 引用，供首个 commit show 等使用——详见设计）。
5. 工作区相对 HEAD **有改动** → 自动创建第一个 stage（仅含实际变更文件）；**无改动** → 不创建 stage。
6. **已初始化** → 提示已存在并跳过，不破坏现有数据。

**作用域：** 初始化整个项目的 Stages 状态；完成后进入第一个 cycle（尚无 stages commit）。

## 4. 与其它流程的关系

- 常被 [snap](./snap.md) 在首次保存时自动触发。
- 成功后可接 [list-status](./list-status.md)、[ide-scm](./ide-scm.md)。

## 5. 模块衔接

| 层级 | 职责 |
|------|------|
| Core | 建目录、写初始 meta、更新 gitignore、可选首 stage |
| CLI | `init` 命令入口与用户提示 |
| 扩展 | 依赖已 init 的存储；不替代 init |

具体路径见系统设计。

## 6. 数据 / 存储（仅本流程）

- 新建 `.stages/` 树与空或含首 stage 的 meta。
- 触及 `.gitignore`。

## 7. 错误与边界

| 场景 | 行为 |
|------|------|
| 非 git 仓库 | 失败并提示 |
| 已初始化 | 跳过并提示 |
| 权限/磁盘错误 | 失败，尽量不留下半初始化状态（实现层保证） |

## 8. 验收要点

- `stages init` 后存在 `.stages/`，且 `.gitignore` 含 `.stages/`
- 干净工作区 init 不产生 stage；脏工作区 init 产生首 stage
- 重复 init 不破坏已有 stages
- 未 init 时首次 `stages` 可自动完成等效初始化

## 9. 非目标 / 后续

- 不支持多项目统一存储；不远程同步。
