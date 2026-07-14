# Stages 系统设计文档

> 版本：v0.2  
> 日期：2026-07-14  
> 基于：[requirements.md](./requirements.md) · [business-flow.md](./business-flow.md) · [features/](./features/)  
> 状态：已确认  
> 说明：跨功能总架构；单流程语义以 features 为准。排期与任务拆分见 `docs2/tasks/project/`（步骤 5）。根目录为 `docs2/`，不修改原 `docs/`。

---

## 1. 文档目的

描述 Stages 的技术栈、仓库结构、模块边界、公共存储与数据模型、API 表面，以及各业务流程在系统中的**落点索引**，作为实现依据。

不在此重复各 feature 的参数表、交互文案与完整业务规则。

---

## 2. 技术栈（已确认，沿用）

| 类别 | 选型 | 说明 |
|------|------|------|
| 仓库结构 | **传统单包 + `extension/` 子目录**（非 monorepo） | CLI 发 npm；扩展发 Marketplace |
| 语言 | TypeScript 5.x | 全项目统一 |
| 运行时 | Node.js >= 18 | CLI 与 core 共用 |
| CLI | **commander** | 子命令；默认 snap 的 `-m` 需解析前拦截（见 §7） |
| Diff | **git subprocess** | `git diff` / `git show` / `git hash-object` 等 |
| 快照 | **内容寻址 blob + manifest** | SHA-256 去重 |
| 扫描 | **fast-glob** + **ignore** | `.gitignore` + **`.stagesignore`（MVP）** |
| 扩展集成 | **直接 import core API** | 经 package `exports`；开发期 `file:..` |
| 测试 | **Vitest** | 单元 + 集成 |
| 主包构建 | **tsup** | ESM（+ 类型） |
| 扩展打包 | **@vscode/vsce** + esbuild | 标准扩展构建 |

### 2.1 为何不用 Monorepo（现阶段）

规模为 1 个 npm 包 + 1 个扩展时，单包成本更低。若后续增加 MCP / Web UI 等再评估 pnpm workspace。

### 2.2 技术决策记录

| # | 决策 | 结果 |
|---|------|------|
| 1 | 仓库结构 | 单包 + extension |
| 2 | Diff | git subprocess |
| 3 | 存储 | blob + manifest |
| 4 | 扩展集成 | import core |
| 5 | CLI | commander |
| 6 | 测试 | Vitest |
| 7 | 忽略规则 | `.gitignore` + `.stagesignore`（MVP） |

---

## 3. 项目结构

```
stages/
├── src/
│   ├── core/                 # 业务核心（无 vscode / commander）
│   │   ├── index.ts          # StagesAPI 导出
│   │   ├── store/            # meta / blob / snapshot / commit 存储
│   │   ├── diff/             # git subprocess + 增量/累计解析
│   │   ├── stage/            # init / create / merge / commit / drop / lifecycle / show
│   │   ├── git/              # HEAD、工作区探测
│   │   └── scanner/          # 文件枚举 + ignore 规则
│   ├── cli/
│   │   ├── index.ts
│   │   └── commands/
│   └── types/
├── bin/stages.js
├── extension/                # 独立 package.json
│   └── src/
│       ├── extension.ts
│       ├── scm/
│       ├── fs/               # stages:// ContentProvider
│       └── commands/
├── test/
│   ├── core/
│   └── fixtures/
├── docs2/                    # 本文档体系（requirements → … → tasks）
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### 3.1 包关系

```
stages (npm)
  exports: "." → core API
  bin: stages
        │
        │ import "stages"
        ▼
extension/  (dependencies: "stages": "file:.." → 发布时 ^x.y.z)
```

### 3.2 主包 exports（示意）

```json
{
  "name": "stages",
  "bin": { "stages": "./bin/stages.js" },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist", "bin"]
}
```

---

## 4. 架构与模块职责

### 4.1 分层

```
┌─────────────────────────────────────────────────────────┐
│  表现层：CLI (commander)  │  Extension (SCM + Virtual FS) │
└───────────────┬───────────────────────────┬─────────────┘
                │                           │
                ▼                           ▼
┌─────────────────────────────────────────────────────────┐
│  业务层 stage/* ：init snap merge commit drop rename …   │
└───────────────┬─────────────┬─────────────┬─────────────┘
                ▼             ▼             ▼
         Diff 层          Store 层       Git / Scanner
         git diff         blob/meta      HEAD / worktree
         resolve*         manifest       ignore 规则
                └─────────────┬─────────────┘
                              ▼
                     .stages/ 持久化
```

### 4.2 设计原则

1. **Core 无 UI 依赖**：不引用 `vscode` / `commander`。  
2. **Git 只读为主**：除 `commit` / `drop`（及 `--force`）写工作区外，不改 git index / history。  
3. **存储自包含**：数据均在 `.stages/`。  
4. **Cycle 一等公民**：`commitId` 区分当前 cycle 与历史；数字 ID 解析仅当前 cycle（[requirements §3.1](./requirements.md)）。  
5. **幂等 init**：`init` 与首次 snap 可安全重复。

### 4.3 Core 模块职责（文件级落点）

| 模块 | 建议路径 | 职责 |
|------|----------|------|
| Init | `core/stage/init.ts` | `.stages/`、meta、gitignore、可选首 stage |
| Create | `core/stage/create.ts` | 扫描 → blob/manifest → 新 stage |
| Merge | `core/stage/merge.ts` | 连续校验、就地合并、prev 重定向 |
| Commit | `core/stage/commit.ts` | 应用快照、写 commit、归档、重置 ID/baseline |
| Drop | `core/stage/drop.ts` | 截断删除、还原工作区 |
| Lifecycle | `core/stage/lifecycle.ts` | rename / list / status |
| Show | `core/stage/show.ts` | stage/commit diff 解析与输出数据 |
| Store | `core/store/*` | meta / blob / manifest / commit 读写 |
| Diff | `core/diff/*` | subprocess、manifest 对比、resolve* |
| Git | `core/git/*` | HEAD、脏检测辅助 |
| Scanner | `core/scanner/*` | glob + gitignore + stagesignore |

---

## 5. 数据模型 / 存储（公共）

### 5.1 目录结构

```
.stages/
├── meta.json
├── blobs/
│   └── ab/
│       └── cdef…           # SHA-256：前 2 位分目录
├── manifests/
│   ├── stage-001.json
│   └── commits/
│       └── commit-001.json # commit 快照清单（实现路径；逻辑 id 仍为 commits/commit-001.json）
└── .lock                   # 可选：并发写锁
```

### 5.2 Blob

内容 → SHA-256 → `blobs/{hash[0:2]}/{hash[2:]}`；已存在则跳过写入。多 stage 共享未改文件的 blob。

### 5.3 Manifest

每个 stage / commit 快照一份 JSON：路径 → `{ hash, mode }`（及必要元数据）。不落完整目录树副本。

### 5.4 meta.json（逻辑模型）

```typescript
interface StagesMeta {
  version: 1;
  /** 初始 git HEAD（commit hash）；首个 stages commit 的 show 左侧等仍依赖此记录 */
  baseline: string;
  /** 当前 cycle 对比用快照：init 后可指向 HEAD 语义；stages commit 后指向该 commit 的 manifest */
  baselineManifestPath: string | null;
  /** 当前 cycle 下一 stage 序号；commit 成功后重置为 1；drop 不回收 */
  nextId: number;
  /** 下一 commit 序号（实现字段） */
  nextCommitId: number;
  stages: StageEntry[];
  commits: CommitEntry[];
}

interface StageEntry {
  id: string;                 // "stage-001"
  name: string;
  status: "pending" | "merged" | "ready" | "committed";
  manifestPath: string;
  createdAt: string;          // ISO；与 id 组成删除精确键
  prev: string | null;
  mergedFrom?: string[];
  mergedInto?: string;
  hidden: boolean;
  /** 有值 ⇒ 已归档到某 stages commit，不属于当前 cycle */
  commitId?: string;
  stats: { files: number; additions: number; deletions: number };
}

interface CommitEntry {
  id: string;                 // "commit-001"
  name: string;
  createdAt: string;
  manifestPath: string;
  stageIds: string[];         // 归档的 stage（扩展 UI 可不展示）
  stats?: { files: number; additions: number; deletions: number };
}
```

**当前 cycle 判定：** `stages` 中 `!commitId` 且未仅作历史展示的条目；active 一般为 `pending`/`ready` 且无 `commitId`。

**同名 ID：** 允许跨 cycle 复用 `stage-00N`；写操作按 `id + createdAt`（及 cycle 过滤）定位。

### 5.5 Diff 实现策略（公共）

- Manifest 先比 hash，筛 changed paths。  
- 将 old/new blob 还原到临时目录，`git diff --no-index`（或等价）出 unified diff。  
- 首 stage / commit-001 左侧可读 git HEAD 或 baseline 记录。  
- **语义端点**见 [features/show.md](./features/show.md) 与 requirements §5.5；累计/增量由 `resolveIncremental` / `resolveCumulative` / `resolveCommit` 实现。

### 5.6 公共错误码（跨流程）

| 错误码 | 含义 |
|--------|------|
| `NOT_GIT_REPO` | 非 git 仓库 |
| `NOT_INITIALIZED` | 未 init（部分命令可自动 init） |
| `STAGE_NOT_FOUND` | stage 无法解析 |
| `MERGE_NOT_CONTIGUOUS` | 合并不连续 |
| `MERGE_INVALID_STATUS` | 合并状态非法 |
| `DIRTY_WORKTREE` | 未 stage 改动且未 `--force` |
| `DROP_STAGE_NOT_FOUND` | 当前 cycle 无该未 commit stage |
| `DROP_INVALID_STATUS` | drop 状态非法 |
| `DROP_CANCELLED` | 用户取消 drop |
| `COMMIT_NOT_FOUND` | commit id 无效 |
| `SNAP_NO_CHANGES` | 无新改动（可成功退出 + 文案） |
| `GIT_NOT_FOUND` | 系统无 git |
| `BLOB_CORRUPT` | hash 校验失败 |

各流程专用文案见对应 feature。

---

## 6. 流程落点索引

| 流程 | Feature | Core 落点 | 备注 |
|------|---------|-----------|------|
| 初始化 | [init](./features/init.md) | `stage/init` | 写 gitignore、baseline |
| 保存 | [snap](./features/snap.md) | `stage/create` + scanner + store | 忽略规则含 stagesignore |
| 列表/概况 | [list-status](./features/list-status.md) | `stage/lifecycle` | 默认过滤当前 cycle |
| 查看 | [show](./features/show.md) | `stage/show` + `diff/*` | 数字 ID → 当前 cycle |
| 合并 | [merge](./features/merge.md) | `stage/merge` | 就地写最后 manifest |
| 重命名 | [rename](./features/rename.md) | `stage/lifecycle` | CLI + 扩展 |
| 提交 | [commit](./features/commit.md) | `stage/commit` | 归档、重置 nextId、更新 baselineManifest |
| 丢弃 | [drop](./features/drop.md) | `stage/drop` | 算法与错误码以 feature 为准 |
| 历史 | [log](./features/log.md) | store + lifecycle | 仅 commits |
| 门禁 | [verify](./features/verify.md) | lifecycle / worktree | 退出码供脚本 |
| IDE | [ide-scm](./features/ide-scm.md) | 扩展 scm/fs + API | 无扩展内 merge/commit |

### 6.1 算法摘要（勿代替 feature）

- **Merge：** 校验连续未提交 → 首 ID 覆盖为末 manifest → 其余 `merged`+hidden → 后续 `prev` 重指向。详见 [merge](./features/merge.md)。  
- **Commit：** 最新 active → 脏检 → 写工作区 → 新建 commit → 打 `commitId` 归档 → `nextId=1` → `baselineManifestPath` 指向本 commit。详见 [commit](./features/commit.md)。  
- **Drop：** 当前 cycle 序号 ≥ N → 确认/脏检 → 还原更早 manifest → 按 `id+createdAt` 删除。详见 [drop](./features/drop.md)。

---

## 7. 公共接口 / 横切能力

### 7.1 StagesAPI（示意）

```typescript
export interface StagesAPI {
  init(projectRoot: string): Promise<void>;
  snap(projectRoot: string, opts?: { message?: string }): Promise<StageEntry>;
  list(projectRoot: string, opts?: { all?: boolean }): Promise<StageEntry[]>;
  show(projectRoot: string, id: string, opts?: { stat?: boolean }): Promise<DiffResult>;
  merge(projectRoot: string, ids: string[], name: string): Promise<StageEntry>;
  rename(projectRoot: string, stageId: string, newName: string): Promise<void>;
  commit(projectRoot: string, opts: { message: string; force?: boolean }): Promise<CommitEntry>;
  planDrop(projectRoot: string, stageId: string): DropPlan;
  drop(projectRoot: string, stageId: string, opts?: { force?: boolean }): Promise<DropResult>;
  verify(projectRoot: string): Promise<VerifyResult>;
  log(projectRoot: string): Promise<CommitEntry[]>;
  status(projectRoot: string): Promise<StatusSummary>;
  listUnstaged?(projectRoot: string): Promise<FileChange[]>;
  getManifest(projectRoot: string, stageId: string): Promise<Manifest>;
  readFile(projectRoot: string, ref: string, filePath: string): Promise<Buffer | null>;
  readBaselineFile(projectRoot: string, filePath: string): Promise<Buffer | null>;
  /** 初始 git HEAD（meta.baseline）文件内容；扩展 commit-001 左侧 */
  readGitHeadFile(projectRoot: string, filePath: string): Promise<Buffer | null>;
}
```

### 7.2 CLI 横切

- **项目根：** 自 cwd 向上找 `.git`（及可选已有 `.stages/`）。  
- **默认 snap 与 `commit -m`：** Commander 短选项冲突 → 解析前识别默认 snap，手动解析 `-m` / `--message` / 粘连形式。  
- **`show` ID 路由：**

| 输入 | 目标 |
|------|------|
| 纯数字 | **当前 cycle** `stage-00N` |
| `stage-00N` | 指定 stage（解析时仍注意 cycle/历史） |
| `commit-00N` / `cN` / `c00N` | commit |
| `--open` | 仅 stage；优先 `cursor`，否则 `code --diff` |

### 7.3 扩展横切

- **StagesSCMProvider：** Unstaged（默认展开）→ stage → commit；Show/Hide Files；`syncGroups()` 保序。  
- **`stages://` ContentProvider：** 读 stage/commit/baseline/**git-head**（初始 HEAD）文件内容；refresh 时使已打开的 `stages://` 文档失效。  
- **Watcher：** `.stages/meta.json` + 工作区变更 → refresh。  
- 交互与验收见 [ide-scm](./features/ide-scm.md)。

### 7.4 安全横切

| 项 | 措施 |
|----|------|
| 路径 | manifest path 禁 `..`；还原限制在项目根内 |
| git 调用 | 参数数组，不拼 shell |
| 完整性 | blob 写后校验 hash |
| 并发 | meta 原子写（temp + rename）；可选 `.lock` |

### 7.5 性能目标（与需求一致）

| 操作 | 目标 | 策略 |
|------|------|------|
| snap ~100 files | < 2s | 去重、并行 hash |
| show | < 1s | 只 diff changed |
| list | < 100ms | 读 meta |
| 扩展刷新 | < 500ms | 缓存 manifest |

---

## 8. 测试与发布

### 8.1 测试

| 层 | 工具 | 覆盖 |
|----|------|------|
| 单元 | Vitest | blob、meta、merge 校验、ID/cycle、忽略规则 |
| 集成 | Vitest + 临时 git repo | snap→merge→commit→drop；跨 cycle 同名 ID |
| 扩展 | @vscode/test-electron（可后补） | SCM、diff |

Fixture：空仓库、简单项目；`beforeEach` 复制到临时目录。

关键用例方向：不污染 git index；数字 ID 仅当前 cycle；commit 后 ID 重置；dirty + `--force`；stagesignore。

### 8.2 构建与发布

```bash
# 主包
tsup src/index.ts src/cli/index.ts --format esm --dts

# 扩展
cd extension && esbuild src/extension.ts --bundle --outdir=dist --external:vscode
```

| 产物 | 渠道 |
|------|------|
| CLI `stages` | npm publish |
| 扩展 | VS Marketplace / Open VSX（vsce / ovsx） |

MVP：`0.x.y`；CLI 与扩展**同版本号**；扩展依赖 `"stages": "^0.x.y"`。

---

## 9. 风险与演进

### 9.1 风险

| 风险 | 缓解 |
|------|------|
| git 未安装或版本差异 | 启动检测；错误码 `GIT_NOT_FOUND` |
| 大仓库 snap 慢 | 忽略规则、并行、增量 hash |
| meta 损坏 | 原子写；后续可考虑备份 |
| 扩展与 CLI 版本漂移 | 同版本发布策略 |

### 9.2 非 MVP 演进

- monorepo / `@stages/core` 拆包  
- `stages revert`、按文件/行采纳  
- `stages gc`（清理 orphan blob）  
- MCP / agent 自动 snap  
- 与 ckpt 互操作、多项目管理  
- commit 的扩展内 `--open`

**不属于「后续才做」：** `.stagesignore`、`stages drop`（已是 MVP，见 requirements）。

---

## 附录：文档地图

```
requirements.md  → 要什么
business-flow.md → 流程总纲
features/*       → 各流程细则
system-design.md → 本文（怎么搭）
tasks/project/   → 任务与进度（步骤 5）
```
