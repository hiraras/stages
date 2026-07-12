# P4 — Merge / Commit / 生命周期

> 预估：2 天  
> 前置依赖：P2  
> 产出：完整的 stage 生命周期管理 + StagesAPI 公共接口

---

## P4-01 实现 merge 校验

**描述：** 合并前的规则校验。

**文件：** `src/core/stage/merge.ts`（部分）

**校验规则：**
| 规则 | 错误码 |
|------|--------|
| 所有 stage 必须存在 | STAGE_NOT_FOUND |
| 状态必须为 pending 或 ready | MERGE_INVALID_STATUS |
| ID 必须连续（序号差为 1） | MERGE_NOT_CONTIGUOUS |
| 不能包含 committed / merged 状态的 stage | MERGE_INVALID_STATUS |
| 至少 2 个 stage | MERGE_TOO_FEW |

**验收标准：**
- [ ] 合并非连续 stage（1+3）抛出 MERGE_NOT_CONTIGUOUS
- [ ] 合并已提交 stage 抛出 MERGE_INVALID_STATUS
- [ ] 合并已 merged 的 stage 抛出 MERGE_INVALID_STATUS
- [ ] 错误消息包含建议的正确合并范围

---

## P4-02 实现 merge 执行

**描述：** 执行 stage 就地合并，将多个 stage 合并为第一个并重命名。

**文件：** `src/core/stage/merge.ts`

**接口：**
```typescript
merge(projectRoot: string, ids: string[], name: string): Promise<StageEntry>
```

**算法：**
```
1. 校验（P4-01）
2. 按 ID 排序，取第一个为保留 stage、最后一个为 manifest 来源
3. 复制最后一个 stage 的 manifest → 第一个 stage 的 manifest
4. 更新保留 stage：name = --name, mergedFrom = [所有被合并 IDs]
5. 被吸收 stage（第 2 个起）：status = merged, hidden = true, mergedInto = 保留 ID
6. 重定向后续 stage 的 prev 指针
7. 计算累计 stats 写入保留 stage
```

**验收标准：**
- [ ] 合并后保留第一个 stage 的 ID，名称更新为 --name
- [ ] 被吸收的 stage status = "merged" 且默认 list 不可见
- [ ] mergedFrom 和 mergedInto 正确记录
- [ ] 保留 stage 的 manifest 与最后一个被合并 stage 一致
- [ ] 必须提供 name 参数

---

## P4-03 实现 `stages merge` CLI 命令

**描述：** CLI 合并命令。

**文件：** `src/cli/commands/merge.ts`

```bash
stages merge 1 2 --name "auth 模块改造"
stages merge stage-001 stage-002 --name "auth 模块改造"
```

**输出示例：**
```
✓ Merged stage-001, stage-002 → stage-auth "auth 模块改造"
  8 files (+200, -40)
```

**验收标准：**
- [ ] 支持短号和完整 ID 混用
- [ ] --name 为必填参数，缺失时报错
- [ ] 校验失败时输出清晰错误

---

## P4-04 实现脏工作区检测

**描述：** 检测工作区是否存在未 stage 的改动。

**文件：** `src/core/git/worktree.ts`

**接口：**
```typescript
detectDirtyFiles(projectRoot: string, latestManifest: Manifest): DirtyFile[]
// DirtyFile = { path, reason: "modified"|"added"|"deleted" }
```

**逻辑：**
```
对比当前工作区文件 vs 最新 stage manifest：
- 工作区有但 manifest 无 → 新增未 stage
- 工作区内容与 manifest blob 不同 → 修改未 stage
- manifest 有但工作区无 → 删除未 stage
```

**验收标准：**
- [ ] 干净工作区返回空数组
- [ ] 正确检测未 stage 的修改
- [ ] 不考虑 git index 状态（只看工作区文件）

---

## P4-05 实现 commit 应用到工作区

**描述：** 将 stage 累计 diff 应用到工作区文件。

**文件：** `src/core/stage/commit.ts`

**接口：**
```typescript
commit(projectRoot: string, opts: { message: string; force?: boolean }): Promise<CommitEntry>
```

**流程：**
```
1. 取当前 cycle 最新 active stage 的 manifest
2. 脏工作区检测 → 有未 stage 文件且无 force → 抛出 DIRTY_WORKTREE
3. applyCumulativeToWorktree() 将累计 diff 应用到工作区
4. 创建 commit 节点，归档本 cycle 所有 stage，重置 stage ID
5. 更新 baselineManifestPath
```

**验收标准：**
- [ ] 新增文件正确创建
- [ ] 修改文件正确覆盖
- [ ] 删除文件正确移除
- [ ] 不修改 git index
- [ ] stage 标记为 committed
- [ ] 路径遍历防护（禁止写入项目根外）

---

## P4-06 实现 `stages commit` CLI 命令

**描述：** CLI commit 命令。

**文件：** `src/cli/commands/commit.ts`

```bash
stages commit -m "auth 模块改造"
stages commit -m "auth 模块改造" --force    # 脏工作区强制应用（覆盖未 stage 改动）
```

**脏工作区警告示例：**
```
⚠ Working tree has uncommitted changes:
  M  src/utils/helper.ts
  A  src/new-file.ts

  These changes are not part of any stage and may be overwritten.
  Use --force to proceed anyway.
```

**验收标准：**
- [ ] 干净工作区直接应用
- [ ] 脏工作区输出警告并退出（exit 1）
- [ ] --force 跳过警告，用最新 stage 快照覆盖工作区（未 stage 改动丢失）
- [ ] 成功后提示 "Run `git add` and `git commit` to commit these changes."

---

## P4-07 实现 rename / hide / unhide

**描述：** stage 生命周期管理。

**文件：** `src/core/stage/lifecycle.ts`

**接口：**
```typescript
rename(projectRoot: string, stageId: string, newName: string): Promise<void>
hide(projectRoot: string, stageId: string): Promise<void>
unhide(projectRoot: string, stageId: string): Promise<void>
```

**规则：**
| 操作 | 允许的状态 | 其他 |
|------|-----------|------|
| rename | pending, ready | committed 不可重命名 |
| hide | committed | 设置 hidden = true |
| unhide | committed（且 hidden） | 设置 hidden = false |

**验收标准：**
- [ ] rename 更新 meta.json 中的 name
- [ ] hide 设置 hidden = true，list 默认不显示
- [ ] unhide 设置 hidden = false，list 恢复显示
- [ ] 对不允许的状态抛出明确错误

---

## P4-08 实现 rename / hide / unhide CLI 命令

**描述：** 对应 CLI 命令。

**文件：** `src/cli/commands/lifecycle.ts`

```bash
stages rename stage-auth "auth 模块 v2"
stages hide stage-001
stages unhide stage-001
```

**验收标准：**
- [ ] 各命令调用对应 core 方法
- [ ] 成功/失败有清晰输出

---

## P4-09 暴露 StagesAPI 公共接口

**描述：** 统一导出 core API，供 CLI 和扩展使用。

**文件：** `src/core/index.ts`

```typescript
export function createStagesAPI(): StagesAPI { ... }

export type {
  StagesAPI,
  StageEntry,
  StageStatus,
  DiffResult,
  StatusSummary,
  Manifest,
};
```

**验收标准：**
- [ ] package.json exports 正确指向 dist/index.js
- [ ] 类型声明 .d.ts 完整导出
- [ ] 扩展可通过 `import { createStagesAPI } from "stages"` 使用
- [ ] API 不暴露内部实现细节

---

## P4-10 生命周期集成测试

**描述：** 完整流程端到端测试。

**文件：** `test/integration/lifecycle.test.ts`

**测试用例：**
- [ ] merge 连续 pending stage 成功
- [ ] merge 非连续 stage 失败
- [ ] merge 已提交 stage 失败
- [ ] 被合并 stage 状态变为 merged
- [ ] commit 应用累计 diff 到工作区
- [ ] commit 后 git status 显示预期变更
- [ ] 脏工作区 commit 无 force 失败
- [ ] 脏工作区 commit 有 force 成功
- [ ] rename pending stage 成功
- [ ] rename committed stage 失败
- [ ] hide / unhide 往返测试
- [ ] list 默认隐藏 hidden stage
