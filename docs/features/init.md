# 初始化 流程细则

> 状态：已确认  
> 总纲：[business-flow.md](../business-flow.md) · `init`  
> 关联：[requirements.md](../requirements.md) · [system-design.md](../system-design.md)

## 1. 范围与动机

在项目内建立 Stages 存储，并把**当前工作区**钉成一个 baseline stages commit，使后续第一次用户 `stages commit` 的 show 只显示 init→该 commit 的增量，而不与相对 git HEAD 的初始内容捆在一起。

## 2. 对外形式

```bash
stages init
stages init -m "bootstrap"
stages init --message=bootstrap
```

首次执行 `stages`（snap）且未初始化时，自动执行**等效于** `stages init`（commit 名默认 `init`）。

## 3. 语义与规则

1. 项目必须是 **git 仓库**。
2. 创建 `.stages/` 与初始 `meta.json`；`meta.baseline` = 当前 **git HEAD**。
3. 若 `.gitignore` 尚无 `.stages/`，则追加写入。
4. **扫描工作区**（`.gitignore` + `.stagesignore`）→ 写入 **`commit-001`**（内容寻址 blob + manifest）。
5. 设置 `baselineManifestPath` 为该 commit；`nextId = 1`；**当前 cycle 无 stage**。
6. Commit 名称：`-m` / `--message`，**默认 `init`**。
7. **不**自动创建 stage；**不**改写工作区内容；**不**执行 `git commit`。
8. 工作区相对 HEAD 干净时仍创建 commit（相对 HEAD 的 show 可为空）。
9. **已初始化** → 提示并跳过，不新建 commit。

**作用域：** 初始化完成后已存在至少一条 stages commit；用户从空 cycle 开始 snap。

## 4. 与其它流程的关系

- 常被 [snap](./snap.md) 自动触发。
- [show](./show.md) / [log](./log.md)：`commit-001` 左侧 = git HEAD；用户后续 commit 为相邻增量。
- [commit](./commit.md)：用户第一次提交一般为 `commit-002`。

## 5. 模块衔接

| 层级 | 职责 |
|------|------|
| Core | 建目录、meta、gitignore、工作区快照 → init commit、更新 baselineManifest |
| CLI | `init [-m]`、打印 baseline / commit 摘要 |
| 扩展 | 依赖已 init；不替代 init |

## 6. 数据 / 存储（仅本流程）

- 新建 `.stages/`、blobs、`commits/commit-001.json`（实现上可在 manifests/commits 下）。
- `commits[]` 含一条；`stageIds` 为空数组。

## 7. 错误与边界

| 场景 | 行为 |
|------|------|
| 非 git 仓库 | 失败并提示 |
| 已初始化 | 跳过并提示 |
| 权限/磁盘错误 | 失败 |

## 8. 验收要点

- init 后存在 `.stages/`，gitignore 含 `.stages/`
- 必有 `commit-001`（或等价），`list` 为空，`log` 有一条
- 脏工作区：`show commit-001` 含相对 HEAD 的改动；其后用户 commit 的 show **不含**这些文件的「再次相对 HEAD」捆包
- `-m` 写入 commit 名称；重复 init 不破坏数据
- 首次 `stages` 可自动等效 init

## 9. 非目标 / 后续

- 不支持多项目统一存储；不远程同步。
