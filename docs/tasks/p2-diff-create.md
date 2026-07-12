# P2 — Diff 引擎 + Stage 创建

> 预估：2 天  
> 前置依赖：P1  
> 产出：可创建 stage、计算增量/累计 diff

---

## P2-01 实现 git subprocess 封装

**描述：** 封装 git 命令调用，使用参数数组避免注入。

**文件：** `src/core/git/`

| 文件 | 功能 |
|------|------|
| `exec.ts` | 通用 git 命令执行 |
| `head.ts` | 获取 HEAD commit hash |
| `show.ts` | `git show HEAD:path` 获取 baseline 文件内容 |

**接口：**
```typescript
getHeadCommit(projectRoot: string): string
getFileAtCommit(projectRoot: string, commit: string, filePath: string): Buffer | null
isGitInstalled(): boolean
```

**验收标准：**
- [ ] git 未安装时抛出 GIT_NOT_FOUND
- [ ] 使用 `execFile` 参数数组，不拼接 shell 字符串
- [ ] 正确处理文件在 commit 中不存在的情况

---

## P2-02 实现 manifest 对比

**描述：** 对比两个 manifest，输出文件级变更列表。

**文件：** `src/core/diff/resolver.ts`（部分）

**接口：**
```typescript
diffManifests(old: Manifest | null, new: Manifest): FileChangeEntry[]
// FileChangeEntry = { path, type: "added"|"modified"|"deleted" }
```

**验收标准：**
- [ ] old 为 null 时（首个 stage），所有文件标记为 added
- [ ] hash 相同的路径不标记为 changed
- [ ] 正确检测 deleted 文件

---

## P2-03 实现临时目录还原 + git diff

**描述：** 将 manifest 还原到临时目录，用 git diff 计算 unified diff。

**文件：** `src/core/diff/engine.ts`

**接口：**
```typescript
materializeManifest(projectRoot: string, manifest: Manifest, tmpDir: string): void
diffDirectories(oldDir: string, newDir: string, filePath: string): string
diffAgainstHead(projectRoot: string, manifest: Manifest, filePath: string): string
```

**流程：**
```
1. 创建 tmp/old 和 tmp/new 目录
2. 将 manifest blob 还原为文件
3. git diff --no-index tmp/old/path tmp/new/path
4. 清理临时目录
```

**验收标准：**
- [ ] 新增文件：old 侧为空，正确生成 diff
- [ ] 删除文件：new 侧为空，正确生成 diff
- [ ] 修改文件：输出标准 unified diff
- [ ] 临时目录使用后必定清理

---

## P2-04 实现增量 diff 解析

**描述：** 计算 stage 相对上一 stage 的 diff。

**文件：** `src/core/diff/resolver.ts`

**接口：**
```typescript
resolveIncremental(projectRoot: string, stageId: string): DiffResult
```

**规则：**
| stage | 左侧 (old) | 右侧 (new) |
|-------|-----------|-----------|
| stage-001 | git HEAD | stage-001 manifest |
| stage-N | stage(N-1) manifest | stage-N manifest |
| merged stage | git HEAD | 合并后 stage manifest（累计） |

**验收标准：**
- [ ] 仅对 changed 文件生成 diff（跳过 hash 相同文件）
- [ ] 返回 `{ files: FileDiff[], stats: { additions, deletions } }`

---

## P2-05 实现累计 diff 解析

**描述：** 计算 stage 相对 git HEAD 的累计 diff（用于 commit）。

**文件：** `src/core/diff/resolver.ts`

**接口：**
```typescript
resolveCumulative(projectRoot: string, stageId: string): DiffResult
```

**验收标准：**
- [ ] 左侧为 git HEAD 文件内容
- [ ] 右侧为 stage manifest 文件内容
- [ ] 正确覆盖新增/修改/删除

---

## P2-06 实现 stats 计算

**描述：** 从 unified diff 输出解析增删行数。

**文件：** `src/core/diff/stats.ts`

**接口：**
```typescript
computeStats(diffOutput: string): { additions: number; deletions: number }
computeStatsFromChanges(changes: FileChangeEntry[], diffs: string[]): Stats
```

**验收标准：**
- [ ] 正确计数 `+` 行（不含 `+++` 头）
- [ ] 正确计数 `-` 行（不含 `---` 头）
- [ ] 与 `stages list` 显示的 stats 一致

---

## P2-07 实现 stage create（snap）流程

**描述：** 核心创建 stage 业务逻辑。

**文件：** `src/core/stage/create.ts`

**接口：**
```typescript
snap(projectRoot: string, opts?: { message?: string }): Promise<StageEntry>
```

**流程：**
```
1. 确保已初始化（未初始化则自动 init）
2. scanWorkspace() 扫描文件
3. 对每个文件 storeBlob() → 构建 manifest
4. 与上一 stage manifest 对比 → 计算 changes + stats
5. 写入 manifest + 更新 meta.json
6. 返回 StageEntry
```

**验收标准：**
- [ ] 首次 snap 生成 stage-001，prev = null
- [ ] 后续 snap 生成 stage-00N，prev 指向上一个 stage
- [ ] 未修改文件 blob 去重（不重复存储）
- [ ] 不修改 git status / git index
- [ ] 不修改工作区文件
- [ ] 支持 -m 设置 stage 名称

---

## P2-08 实现 init 初始化流程

**描述：** 初始化 .stages/ 目录和 baseline。

**文件：** `src/core/stage/init.ts`

**接口：**
```typescript
init(projectRoot: string): Promise<void>
```

**流程：**
```
1. 检查是否 git 仓库
2. 创建 .stages/ 目录结构（blobs/, manifests/）
3. 写入初始 meta.json（baseline = git HEAD, nextId = 1, stages = []）
4. 将 .stages/ 追加到 .gitignore（若不存在）
5. 若工作区相对 HEAD 有改动，自动创建 stage-001（仅含实际变更）
6. 已初始化时提示并跳过
```

**验收标准：**
- [ ] 创建完整目录结构
- [ ] meta.json baseline 记录当前 HEAD
- [ ] .gitignore 自动更新
- [ ] 工作区无改动时不创建 stage
- [ ] 工作区有改动时自动创建 stage-001，stats 仅统计相对 HEAD 的变更
- [ ] 重复 init 不报错，提示已存在

---

## P2-09 Diff + Create 集成测试

**描述：** 端到端测试 stage 创建和 diff 计算。

**文件：** `test/integration/snap.test.ts`

**测试用例：**
- [ ] 在 fixture 仓库执行 init + snap → 生成 stage-001
- [ ] 修改文件后 snap → 生成 stage-002
- [ ] stage-002 增量 diff 仅包含修改的文件
- [ ] stage-001 累计 diff 相对 git HEAD 正确
- [ ] snap 后 git status 不变
- [ ] 未修改文件的 blob hash 在 stage-001 和 stage-002 间相同
