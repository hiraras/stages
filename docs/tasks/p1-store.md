# P1 — 存储层

> 预估：2 天  
> 前置依赖：P0  
> 产出：blob / manifest / meta 完整读写能力

---

## P1-01 定义 TypeScript 类型

**描述：** 在 `src/types/` 中定义所有核心数据结构。

**交付物：** `src/types/index.ts`

```typescript
// 需定义的类型
StageStatus = "pending" | "merged" | "ready" | "committed"
StageEntry
StagesMeta
Manifest
ManifestFileEntry
FileChange = "added" | "modified" | "deleted"
DiffResult
StatusSummary
```

**验收标准：**
- [ ] 类型与 system-design §5.4 meta.json 结构一致
- [ ] 导出供 core 和 cli 使用

---

## P1-02 实现 blob 存储

**描述：** 内容寻址 blob 读写，SHA-256 哈希，前 2 位分目录。

**文件：** `src/core/store/blob.ts`

**接口：**
```typescript
storeBlob(content: Buffer): string    // 返回 hash
readBlob(hash: string): Buffer
blobExists(hash: string): boolean
```

**验收标准：**
- [ ] 相同内容存储后返回相同 hash
- [ ] 已存在 blob 不重复写入
- [ ] 存储路径：`.stages/blobs/{hash[0:2]}/{hash[2:]}`
- [ ] 写入后校验 SHA-256 完整性

---

## P1-03 实现 manifest 读写

**描述：** 每个 stage 对应一个 manifest JSON 文件。

**文件：** `src/core/store/manifest.ts`

**接口：**
```typescript
writeManifest(projectRoot: string, manifest: Manifest): void
readManifest(projectRoot: string, stageId: string): Manifest
compareManifests(old: Manifest, new: Manifest): FileChange[]
```

**验收标准：**
- [ ] manifest 存储在 `.stages/manifests/{stageId}.json`
- [ ] compareManifests 正确识别 added / modified / deleted
- [ ] 通过 hash 对比判断 modified

---

## P1-04 实现 meta.json 读写

**描述：** 全局元数据管理，支持原子写入。

**文件：** `src/core/store/meta.ts`

**接口：**
```typescript
readMeta(projectRoot: string): StagesMeta
writeMeta(projectRoot: string, meta: StagesMeta): void
addStage(projectRoot: string, entry: StageEntry): void
updateStage(projectRoot: string, id: string, patch: Partial<StageEntry>): void
getStage(projectRoot: string, id: string): StageEntry
findStages(projectRoot: string, filter?: { all?: boolean }): StageEntry[]
```

**验收标准：**
- [ ] 写入使用 temp file + rename 原子操作
- [ ] `findStages` 默认过滤 `hidden: true` 的 stage
- [ ] `findStages({ all: true })` 包含隐藏 stage
- [ ] `nextId` 自增正确

---

## P1-05 实现 stage ID 自增生成器

**描述：** 生成 `stage-001` 格式 ID。

**文件：** `src/core/store/id.ts`

**接口：**
```typescript
generateStageId(meta: StagesMeta): string  // "stage-001", "stage-002", ...
resolveStageId(meta: StagesMeta, input: string): string  // 支持 "1" → "stage-001"
```

**验收标准：**
- [ ] ID 格式为 `stage-{NNN}`，三位数字补零
- [ ] `resolveStageId` 支持完整 ID 和短号输入
- [ ] 无效输入抛出 STAGE_NOT_FOUND

---

## P1-06 实现文件扫描器

**描述：** 遍历工作区文件，遵循 `.gitignore`。

**文件：** `src/core/scanner/files.ts`

**接口：**
```typescript
scanWorkspace(projectRoot: string): ScannedFile[]
// ScannedFile = { relativePath: string, content: Buffer, mode: string }
```

**验收标准：**
- [ ] 使用 fast-glob 扫描，ignore 包处理 .gitignore
- [ ] 排除 `.git/`、`.stages/`、`node_modules/`
- [ ] 返回相对路径（posix 风格）

---

## P1-07 实现项目根目录发现

**描述：** 向上查找 git 仓库根目录。

**文件：** `src/core/git/worktree.ts`（部分）

**接口：**
```typescript
findProjectRoot(startDir?: string): string
isGitRepo(dir: string): boolean
isInitialized(dir: string): boolean  // 是否存在 .stages/
```

**验收标准：**
- [ ] 从 cwd 向上遍历找到含 `.git` 的目录
- [ ] 非 git 仓库抛出 NOT_GIT_REPO
- [ ] 找不到时抛出明确错误

---

## P1-08 存储层单元测试

**描述：** 覆盖 P1 所有模块的单元测试。

**文件：** `test/core/store/`

**测试用例：**
- [ ] blob 存储与去重
- [ ] blob 完整性校验
- [ ] manifest 读写与对比
- [ ] meta 读写与原子写入
- [ ] stage ID 生成与解析
- [ ] 文件扫描器遵循 gitignore
- [ ] 项目根目录发现
