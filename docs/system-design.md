# Stages 系统设计文档

> 版本：v0.1  
> 日期：2026-07-10  
> 基于：[requirements.md](./requirements.md)  
> 状态：技术栈已确认

---

## 1. 文档目的

本文档描述 Stages 的技术架构、模块划分、数据模型、核心流程与实现方案，作为开发实现的直接依据。

---

## 2. 技术栈（已确认）

| 类别 | 选型 | 说明 |
|------|------|------|
| 仓库结构 | **传统单包 + 扩展子目录**（非 monorepo） | 主包发布 npm，扩展独立发布 VS Marketplace |
| 语言 | TypeScript 5.x | 全项目统一 |
| 运行时 | Node.js >= 18 | CLI 与 core 共用 |
| CLI 框架 | **commander** | 子命令、参数解析 |
| Diff 引擎 | **git subprocess** | `git diff` / `git show` / `git hash-object` |
| 快照存储 | **内容寻址 blob + manifest** | SHA-256 去重 |
| 扩展集成 | **扩展直接 import stages core API** | 通过 package exports 暴露 |
| 测试 | **Vitest** | 单元 + 集成测试 |
| 构建 | **tsup** | 打包 CLI 与 core 为 ESM/CJS |
| 文件扫描 | **fast-glob** + **ignore** | 遵循 `.gitignore` |
| 扩展打包 | **@vscode/vsce** + esbuild | 标准 VS Code 扩展构建 |

### 2.1 为何不用 Monorepo

当前项目规模小（1 个 npm 包 + 1 个扩展），传统结构足够：

| 对比 | 传统单包 | Monorepo |
|------|----------|----------|
| 上手成本 | 低 | 需配置 workspace / turbo |
| 共享 core | 主包 exports API，扩展 `file:..` 引用 | 独立 `@stages/core` 包 |
| 发布 | CLI 发 npm，扩展发 Marketplace | 需协调多包版本 |
| 适用阶段 | MVP ~ 中期 | 多包、多团队时更合适 |

**后续演进：** 若增加独立 MCP server、Web UI 等，可再迁移到 pnpm workspace。

---

## 3. 项目结构

```
stages/
├── src/
│   ├── core/                    # 核心业务逻辑（可被 CLI 和扩展共用）
│   │   ├── index.ts             # 公共 API 导出
│   │   ├── store/               # 存储层
│   │   │   ├── meta.ts          # meta.json 读写
│   │   │   ├── blob.ts          # blob 存取与去重
│   │   │   └── snapshot.ts      # 快照构建与还原
│   │   ├── diff/                # diff 计算
│   │   │   ├── engine.ts        # git subprocess 封装
│   │   │   └── resolver.ts      # 增量/累计 diff 解析
│   │   ├── stage/               # stage 业务
│   │   │   ├── create.ts        # 创建 stage
│   │   │   ├── merge.ts         # 合并 stage
│   │   │   ├── commit.ts        # 应用到工作区
│   │   │   ├── drop.ts          # 删除尾部 stage + 还原工作区
│   │   │   └── lifecycle.ts     # rename / hide / status
│   │   ├── git/                 # git 交互
│   │   │   ├── head.ts          # 获取 HEAD
│   │   │   └── worktree.ts      # 工作区状态检测
│   │   └── scanner/             # 文件扫描
│   │       └── files.ts         # 遍历 + gitignore 过滤
│   ├── cli/                     # CLI 入口
│   │   ├── index.ts             # commander 注册
│   │   └── commands/            # 各子命令实现
│   └── types/                   # 共享类型定义
│       └── index.ts
├── bin/
│   └── stages.js                # CLI 可执行入口
├── extension/                   # VS Code / Cursor 扩展（独立 package.json）
│   ├── src/
│   │   ├── extension.ts         # 激活入口
│   │   ├── scm/                 # SCM Provider
│   │   │   └── stagesProvider.ts
│   │   ├── fs/                  # 虚拟文件系统
│   │   │   └── stagesFs.ts
│   │   └── commands/            # 扩展命令（refresh、rename 等）
│   ├── package.json
│   └── tsconfig.json
├── test/                        # Vitest 测试
│   ├── core/
│   └── fixtures/                # 测试用 git 仓库
├── docs/
│   ├── requirements.md
│   └── system-design.md
├── package.json                 # 主包，exports core API
├── tsconfig.json
└── tsup.config.ts
```

### 3.1 包关系

```
┌─────────────────────────────────────┐
│  stages (npm 包)                     │
│  exports:                            │
│    "."        → dist/index.js (core)│
│    "./cli"    → dist/cli/index.js   │
│  bin: stages                         │
└──────────────┬──────────────────────┘
               │ import "stages"
               ▼
┌─────────────────────────────────────┐
│  extension/ (VS Code 扩展)             │
│  dependencies:                       │
│    "stages": "file:.."              │
└─────────────────────────────────────┘
```

### 3.2 package.json exports（主包）

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

## 4. 系统架构

### 4.1 分层架构

```
┌──────────────────────────────────────────────────────────┐
│  表现层                                                    │
│  ┌─────────────┐    ┌──────────────────────────────────┐ │
│  │  CLI        │    │  VS Code Extension               │ │
│  │  commander  │    │  SCM Provider + Virtual FS           │ │
│  └──────┬──────┘    └──────────────┬───────────────────┘ │
└─────────┼──────────────────────────┼─────────────────────┘
          │                          │
          ▼                          ▼
┌──────────────────────────────────────────────────────────┐
│  业务层 (src/core/stage/)                                  │
│  create │ merge │ commit │ drop │ rename │ hide │ list │ show    │
└──────────────────────────┬───────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Diff 层     │  │  Store 层    │  │  Git 层      │
│  git diff    │  │  blob/meta   │  │  HEAD/status │
│  diff解析    │  │  snapshot    │  │  worktree    │
└──────────────┘  └──────────────┘  └──────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  存储层 (.stages/)                                        │
│  meta.json │ blobs/ │ manifests/                          │
└──────────────────────────────────────────────────────────┘
```

### 4.2 设计原则

1. **Core 无 UI 依赖**：`src/core` 不引用 `vscode` 或 `commander`
2. **Git 只读为主**：除 `stages commit`、`stages drop` 写工作区外，其余操作只读取 git
3. **存储自包含**：所有 stage 数据在 `.stages/`，可随项目迁移
4. **幂等初始化**：`init` 和首次 `snap` 可安全重复执行

---

## 5. 存储设计

### 5.1 目录结构

```
.stages/
├── meta.json                 # 全局元数据 + stage 列表
├── blobs/
│   └── ab/
│       └── cdef1234...       # SHA-256 前2位分目录
├── manifests/
│   ├── stage-001.json        # 快照文件清单
│   ├── stage-002.json
│   └── stage-auth.json
└── .lock                     # 可选：并发写入锁
```

### 5.2 Blob 存储

```typescript
// 写入
function storeBlob(content: Buffer): string {
  const hash = sha256(content);          // "abcdef1234..."
  const path = `.stages/blobs/${hash.slice(0,2)}/${hash.slice(2)}`;
  if (!exists(path)) writeFile(path, content);
  return hash;
}

// 读取
function readBlob(hash: string): Buffer {
  return readFile(`.stages/blobs/${hash.slice(0,2)}/${hash.slice(2)}`);
}
```

**去重效果：** 未修改的文件在多个 stage 间共享同一 blob，仅 manifest 不同。

### 5.3 Manifest（快照清单）

每个 stage 对应一个 manifest，记录该快照包含的文件及其 blob 引用：

```json
{
  "stageId": "stage-001",
  "createdAt": "2026-07-08T14:30:00Z",
  "files": {
    "src/auth/login.ts": {
      "hash": "abc123...",
      "mode": "100644"
    },
    "src/auth/register.ts": {
      "hash": "def456...",
      "mode": "100644"
    }
  }
}
```

**对比完整文件树快照：** 不复制文件路径树，仅保存 manifest → blob 映射，节省空间且便于 diff。

### 5.4 meta.json 完整结构

```typescript
interface StagesMeta {
  version: 1;
  baseline: string;           // git HEAD commit hash
  nextId: number;             // 自增序号，用于生成 stage-00N
  stages: StageEntry[];
}

interface StageEntry {
  id: string;                 // "stage-001"
  name: string;
  status: StageStatus;
  manifestPath: string;       // "manifests/stage-001.json"
  createdAt: string;          // ISO 8601
  prev: string | null;        // 上一个 stage ID（链式）
  mergedFrom?: string[];      // 合并来源
  mergedInto?: string;        // 被合并到哪个 stage
  hidden: boolean;
  stats: {
    files: number;
    additions: number;
    deletions: number;
  };
}

type StageStatus = "pending" | "merged" | "ready" | "committed";
```

### 5.5 创建快照流程

```
stages snap
  │
  ├─ 1. 扫描工作区文件（fast-glob + ignore）
  │
  ├─ 2. 对每个文件：
  │     ├─ 读取内容 → storeBlob() → 获得 hash
  │     └─ 写入 manifest.files[path] = { hash, mode }
  │
  ├─ 3. 与上一 stage manifest 对比：
  │     ├─ 新增文件：出现在当前 manifest，不在 prev
  │     ├─ 删除文件：出现在 prev，不在当前
  │     ├─ 修改文件：hash 不同
  │     └─ 计算 stats（additions/deletions 通过 diff 引擎）
  │
  ├─ 4. 写入 manifest + 更新 meta.json
  │
  └─ 5. 返回 stage 摘要
```

---

## 6. Diff 引擎设计

### 6.1 策略：Git Subprocess

利用系统 git 命令处理 diff，优势：

- baseline（git HEAD）天然准确
- diff 输出格式标准（unified diff）
- 无需引入 libgit2 / isomorphic-git 等重依赖

### 6.2 核心封装

```typescript
// src/core/diff/engine.ts

interface DiffEngine {
  /** 两个 blob 之间的 unified diff */
  diffBlobs(oldContent: string | null, newContent: string | null, filePath: string): string;

  /** 两个 manifest 之间的文件变更列表 */
  diffManifests(oldManifest: Manifest, newManifest: Manifest): FileChange[];

  /** stage 增量 diff：resolve(stageId) → diff(prevStage, currentStage) */
  resolveIncremental(stageId: string): DiffResult;

  /** stage 累计 diff：resolveCumulative(stageId) → diff(git HEAD, currentStage) */
  resolveCumulative(stageId: string): DiffResult;
}
```

### 6.3 Diff 解析规则

| 场景 | 左侧 (old) | 右侧 (new) |
|------|-----------|-----------|
| stage-001（首个） | `git show HEAD:path` 或空 | stage-001 manifest blob |
| stage-N（增量） | stage(N-1) manifest blob | stage-N manifest blob |
| merged stage（show） | git HEAD | 合并后 stage manifest（累计） |
| commit（累计） | git HEAD 工作区文件 | merged stage manifest blob |

### 6.4 实现方式

由于 snapshot 存在 blob 中而非 git tree，diff 时采用 **临时目录法**：

```
1. 将 manifest 中的 blob 还原到临时目录 tmp/old/ 和 tmp/new/
2. 执行：git diff --no-index tmp/old/path tmp/new/path
3. 清理临时目录
```

对于首个 stage（相对 git HEAD）：

```
1. tmp/new/ ← 从 manifest 还原
2. git diff HEAD -- tmp/new/   或逐文件 git diff
```

**性能优化：** 仅对 manifest diff 中标记为 changed 的文件执行 diff，跳过 hash 相同的文件。

### 6.5 stats 计算

```typescript
function computeStats(diffOutput: string): { additions: number; deletions: number } {
  // 解析 unified diff 中 +/- 行（排除 --- / +++ 头）
}
```

---

## 7. 核心业务模块

### 7.1 模块职责

| 模块 | 文件 | 职责 |
|------|------|------|
| **Init** | `core/stage/init.ts` | 创建 `.stages/`、写 meta.json、更新 `.gitignore`；有改动时自动创建 stage-001 |
| **Create** | `core/stage/create.ts` | 扫描工作区 → 构建 manifest → 写入 stage |
| **Merge** | `core/stage/merge.ts` | 校验连续性 → 就地合并到第一个 stage → 隐藏被吸收 stage |
| **Commit** | `core/stage/commit.ts` | 累计 diff → 应用到工作区 → 标记 committed |
| **Drop** | `core/stage/drop.ts` | 删除尾部 stage → 还原工作区 → 更新 meta（见 [stage-drop.md](./features/stage-drop.md)） |
| **Lifecycle** | `core/stage/lifecycle.ts` | rename、hide、unhide、list、status |
| **Show** | `core/stage/show.ts` | 解析 diff → 终端输出或调起编辑器 |

### 7.2 公共 API（供 CLI 和扩展调用）

```typescript
// src/core/index.ts

export interface StagesAPI {
  init(projectRoot: string): Promise<void>;
  snap(projectRoot: string, opts?: { message?: string }): Promise<StageEntry>;
  list(projectRoot: string, opts?: { all?: boolean }): Promise<StageEntry[]>;
  show(projectRoot: string, stageId: string, opts?: { stat?: boolean }): Promise<DiffResult>;
  merge(projectRoot: string, ids: string[], name: string): Promise<StageEntry>;
  rename(projectRoot: string, stageId: string, newName: string): Promise<void>;
  commit(projectRoot: string, opts: { message: string; force?: boolean }): Promise<CommitEntry>;
  planDrop(projectRoot: string, stageId: string): DropPlan;
  drop(projectRoot: string, stageId: string, opts?: { force?: boolean }): Promise<DropResult>;
  verify(projectRoot: string): Promise<VerifyResult>;
  log(projectRoot: string): Promise<CommitEntry[]>;
  hide(projectRoot: string, stageId: string): Promise<void>;
  unhide(projectRoot: string, stageId: string): Promise<void>;
  status(projectRoot: string): Promise<StatusSummary>;
  getManifest(projectRoot: string, stageId: string): Promise<Manifest>;
  readFile(projectRoot: string, stageId: string, filePath: string): Promise<Buffer | null>;
}
```

### 7.3 Merge 算法

```
输入：ids = ["stage-001", "stage-002"], name = "auth 模块改造"

1. 校验
   ├─ 所有 stage status ∈ {pending, ready}
   ├─ ID 连续（序号差为 1）
   └─ 无已 committed / merged 的 stage

2. 取最后一个 stage 的 manifest 作为合并结果
   （因为 stage 是链式增量，最后一个已包含所有前序变更）

3. 就地合并到第一个 stage：
   ├─ 保留第一个 stage 的 ID（如 stage-001）
   ├─ 复制 manifest → manifests/stage-001.json（覆盖）
   ├─ name = --name 参数
   ├─ mergedFrom = ["stage-001", "stage-002", ...]
   └─ prev 保持不变

4. 更新被吸收的 stage（第 2 个及之后）：
   ├─ status = "merged"
   ├─ mergedInto = "stage-001"
   └─ hidden = true

5. 重定向后续 stage 的 prev 指针（如 stage-003.prev → stage-001）

6. 写入 meta.json
```

> **关键：** 因 stage 是链式快照，合并时直接取最后一个 stage 的 manifest 即为累计状态，无需重新合并 blob。

### 7.4 Commit 算法

```
输入：message = "auth 模块改造"

1. 取当前 cycle 最新 active stage 的 manifest
2. 脏工作区检测（对比最新 stage manifest 与工作区文件）
   - 无 `--force`：列出未 stage 文件 → 抛出 DIRTY_WORKTREE
   - 有 `--force`：跳过检测，继续执行（未 stage 改动将被覆盖）
3. 应用累计 diff 到工作区（相对 baseline manifest 或 git HEAD）
4. 创建 commit-001 节点，保存快照到 commits/
5. 归档本 cycle 所有 stage（含 merged），stage ID 重置为 1
6. 更新 baselineManifestPath 为本次 commit 快照
```

> 历史 commit 用 `stages log` 查看；归档 stage 用 `stages list --all` 查看。

### 7.5 Drop 算法

详见 [features/stage-drop.md](./features/stage-drop.md)。

```
输入：id = stage-N

1. 在当前 cycle 解析 pending/ready 目标（!commitId）；未找到 → DROP_STAGE_NOT_FOUND
2. 删除集合 = 当前 cycle 内序号 ≥ N 的未 commit stage（含 merged hidden）
3. 恢复目标 = max(序号 < N 的 pending/ready stage) manifest，或 cycle baseline
4. 脏工作区检测（相对恢复目标）→ 用户确认（--yes 跳过）→ --force 可覆盖
5. 应用恢复目标 manifest 到工作区
6. 按 id+createdAt 从 meta 移除删除集合；nextId 不变；删 manifest 文件，不 GC blob
```

**ID 空洞：** 不重编号。例：drop 5 后 snap 得 stage-006，再 drop 4 会删 stage-004 与 stage-006。

**跨 cycle 重复 ID：** 每次 commit 后 ID 重置，历史 stage 保留在 meta（带 `commitId`）。drop 只匹配/删除当前 cycle 条目，不会误操作历史 committed stage。

---

## 8. CLI 设计

### 8.1 命令树

```
stages                          # 默认 = snap
stages snap [-m <message>]       # 创建 stage
stages init                      # 初始化
stages list [--all]              # 列出 stage
stages show <id> [--stat] [--open]  # stage 或 commit diff
stages merge <ids...> --name <n> # 合并
stages rename <id> <name>        # 重命名
stages commit -m <msg> [--force] # 提交当前 cycle
stages drop <id> [--yes] [--force] # 删除序号 ≥ N 的 stage
stages log                       # commit 历史
stages verify                    # 构建前检查
stages hide <id>                 # 隐藏
stages unhide <id>               # 取消隐藏
stages status                    # 概况
```

### 8.2 项目根目录发现

```typescript
function findProjectRoot(cwd: string): string {
  // 向上查找包含 .git 和 .stages/（或仅 .git）的目录
  // 与 git 行为一致
}
```

### 8.3 `stages show --open` 实现

```typescript
async function openInEditor(oldPath: string, newPath: string, label: string) {
  const editor = process.env.EDITOR || detectEditor();  // code / cursor
  execSync(`${editor} --diff "${oldPath}" "${newPath}"`);
}
```

优先检测 `cursor` 命令，fallback 到 `code`。

### 8.4 `show` ID 解析

`stages show <id>` 根据 ID 格式路由到 stage 或 commit：

| 输入 | 解析目标 | 示例 |
|------|----------|------|
| 纯数字 | 当前 cycle 的 `stage-00N` | `1` → 当前 cycle `stage-001` |
| `stage-00N` | 指定 stage（含历史） | `stage-001` |
| `commit-00N` | 指定 commit | `commit-001` |
| `cN` / `c00N` | commit 简写 | `c1` → `commit-001` |

**Commit diff 算法**（`resolveCommit`）：

```
commit-001: diff(git HEAD, commit-001 manifest)
commit-00N: diff(commit-00(N-1) manifest, commit-00N manifest)
```

**限制：** commit show 支持 `--stat`；`--open` 暂不支持（仅 stage）。

### 8.5 `-m` 参数解析

根命令（默认 snap）和 `commit` 子命令都使用 `-m` 传参。Commander 不支持根命令与子命令注册同名短选项，因此采用**解析前拦截**：

```typescript
// 默认 snap 调用在 Commander 解析前拦截
const argv = process.argv.slice(2);
if (isDefaultSnapInvocation(argv)) {
  runSnap(parseSnapMessage(argv));  // 手动解析 -m / --message / -m粘连
} else {
  program.parseAsync(process.argv); // commit 等子命令由 Commander 处理 -m
}
```

**`isDefaultSnapInvocation` 判定：**

- 无参数 → snap（如 `stages`）
- 首参数以 `-` 开头且非 `--help` / `--version` → snap（如 `stages -m "xx"`）
- 首参数不在子命令列表 → snap
- 否则 → 交给 Commander（如 `stages commit -m "xx"`）

**snap 支持的 `-m` 形式：**

| 形式 | 示例 |
|------|------|
| 空格分隔 | `stages -m "登录改造"` |
| 粘连 | `stages -m登录改造` |
| 长选项 | `stages --message=登录改造` |
| 显式子命令 | `stages snap -m "..."`（hidden 子命令，走 Commander） |

---

## 9. VS Code / Cursor 扩展设计

### 9.1 架构

```
extension.ts (activate)
  │
  ├─ StagesSCMProvider           # Source Control 内 Stages 区域
  │    ├─ Unstaged ResourceGroup（默认展开）
  │    ├─ stage / commit ResourceGroup（Show Files 展开）
  │    └─ ResourceState → stages.openDiff
  │
  ├─ StagesFileSystemProvider    # stages:// 虚拟 URI
  │
  └─ FileWatcher                 # 监听 .stages/meta.json + 工作区文件变更
```

### 9.2 SCM 面板结构

```
Source Control → Stages
├── Unstaged Changes [3]          ← 默认展开，api.listUnstaged()
│   ├── M  src/auth/login.ts
│   └── A  src/auth/register.ts
├── 3 权限改造 [pending]           ← 默认收起，点 Show Files 加载文件列表
├── 1 auth 模块改造 [pending]
├── 2 权限模块 [commit]
└── 1 auth 模块改造 [commit]

(stage / commit 均为新 → 旧；无 unstaged 改动时不显示 Unstaged 分组)
```

**展开策略：**

| 类型 | 默认状态 | 加载时机 |
|------|----------|----------|
| Unstaged | 展开 | 面板刷新时立即加载 |
| stage / commit | 收起 | 用户点击 **Show Files** 时加载；**Hide Files** 清空列表；状态不跨会话 |

**实现说明：** 使用 SCM `ResourceGroup` + `Show Files` / `Hide Files` 命令；展开状态仅存于内存。VS Code 按 ResourceGroup 创建顺序显示，刷新时通过 `syncGroups()` 检测顺序偏差并重建分组，保证 Unstaged → stage（新→旧）→ commit（新→旧）。

### 9.3 Diff 打开流程

**Stage：**

```
用户点击 stage-auth 下的 src/auth/login.ts
  │
  ├─ 1. 确定左侧版本：
  │     prevStage = getPrevStage("stage-auth")
  │     leftUri = stages://{prevStage}/src/auth/login.ts  （或 baseline）
  │
  ├─ 2. 确定右侧版本：
  │     rightUri = stages://stage-auth/src/auth/login.ts
  │
  └─ 3. vscode.diff(leftUri, rightUri, "stage-auth: login.ts")
```

**Commit（P5-10，与 CLI resolveCommit 一致）：**

```
用户点击 commit-001 下的 src/auth/login.ts
  │
  ├─ commit-001：leftUri = stages://baseline/...  rightUri = stages://commit-001/...
  ├─ commit-00N：leftUri = stages://commit-00(N-1)/...  rightUri = stages://commit-00N/...
  └─ vscode.diff(leftUri, rightUri, "auth 模块改造: login.ts")
```

ContentProvider 需识别 `commit-*` authority，通过 commit manifest（`commits/commit-001.json`）读取 blob。

### 9.4 文件监听与刷新

```typescript
const watcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(root, '.stages/meta.json')
);
watcher.onDidChange(() => scmProvider.refresh());
```

### 9.5 扩展与 Core 的依赖

```json
// extension/package.json
{
  "dependencies": {
    "stages": "file:.."
  }
}
```

扩展直接调用 `StagesAPI`，不通过子进程。发布时改为 `"stages": "^0.1.0"` 依赖 npm 上的包。

---

## 10. 关键流程时序

### 10.1 跨会话组批提交

```
开发者          CLI              Core              .stages/         Git
  │              │                │                  │              │
  │─ stages ────>│── snap() ─────>│── scan files ───>│── write blob │
  │              │                │── write manifest─>│              │
  │              │                │── update meta ───>│              │
  │<─ stage-001 ─│<───────────────│                  │              │
  │              │                │                  │              │
  │  ... 次日 ...│                │                  │              │
  │─ stages ────>│── snap() ─────>│─────────────────>│── stage-002  │
  │              │                │                  │              │
  │─ merge 1 2 ─>│── merge() ────>│── validate ─────>│              │
  │              │                │── create auth ───>│── stage-auth │
  │              │                │── mark merged ───>│              │
  │              │                │                  │              │
  │  (IDE 查看 diff)             │                  │              │
  │              │                │                  │              │
  │─ commit auth >│── commit() ───>│── diff cumul. ─────────────────>│
  │              │                │── apply to FS ───────────────────>│ (工作区变更)
  │              │                │── mark committed─>│              │
  │─ git add ────────────────────────────────────────────────────────>│
  │─ git commit ─────────────────────────────────────────────────────>│
```

### 10.2 扩展查看 diff

```
用户点击文件     Extension           Core              Virtual FS
  │                │                  │                  │
  │─ click file ──>│── readFile() ───>│── readBlob() ───>│
  │                │── readFile() ───>│── readBlob() ───>│ (prev stage)
  │                │── vscode.diff() ─────────────────────────────────>│
  │<─ diff editor ─│                  │                  │
```

---

## 11. 错误处理

| 场景 | 错误码 | 处理 |
|------|--------|------|
| 非 git 仓库 | `NOT_GIT_REPO` | 提示先 `git init` |
| 未初始化 | `NOT_INITIALIZED` | 自动 init 或提示 `stages init` |
| stage 不存在 | `STAGE_NOT_FOUND` | 列出可用 stage ID |
| 合并不连续 | `MERGE_NOT_CONTIGUOUS` | 说明需连续 ID |
| 合并已提交 stage | `MERGE_INVALID_STATUS` | 列出冲突 stage 状态 |
| 脏工作区 commit | `DIRTY_WORKTREE` | 列出未 stage 文件 + 提示 `--force`（`--force` 将覆盖未 stage 改动） |
| 脏工作区 drop | `DIRTY_WORKTREE` | 同上（相对恢复目标 manifest 检测） |
| drop 指定 ID 不存在（当前 cycle 无未 commit stage） | `DROP_STAGE_NOT_FOUND` | `No uncommitted stage with id stage-00N exists.` |
| drop 目标 status 无效 | `DROP_INVALID_STATUS` | 说明仅可 drop pending/ready stage |
| 用户取消 drop | `DROP_CANCELLED` | 不修改数据，退出 |
| commit 不存在 | `COMMIT_NOT_FOUND` | 提示 commit ID 无效 |
| 无新改动 snap | `SNAP_NO_CHANGES` | 输出 `No new changes.` |
| git 未安装 | `GIT_NOT_FOUND` | 提示安装 git |
| blob 损坏 | `BLOB_CORRUPT` | 提示 hash 不匹配，数据可能损坏 |

---

## 12. 性能考量

| 操作 | 目标 | 策略 |
|------|------|------|
| snap（100 文件） | < 2s | blob 去重跳过未变文件；并行 hash 计算 |
| show diff | < 1s | 仅 diff changed files；临时目录并行还原 |
| list | < 100ms | 只读 meta.json |
| 扩展刷新 | < 500ms | 增量读取 meta.json；缓存 manifest |

### 12.1 Blob 去重收益示例

```
stage-001: 100 files → 100 blobs
stage-002: 100 files, 3 changed → 3 new blobs + 97 refs reused
stage-003: 100 files, 5 changed → 5 new blobs + 95 refs reused

总存储：108 blobs（而非 300）
```

---

## 13. 测试策略

### 13.1 测试分层

| 层 | 工具 | 覆盖 |
|----|------|------|
| 单元测试 | Vitest | blob store、meta 读写、merge 校验、ID 生成 |
| 集成测试 | Vitest + 临时 git repo | 完整 snap → merge → commit 流程 |
| 扩展测试 | @vscode/test-electron | SCM 渲染、diff 打开（后续补充） |

### 13.2 测试 Fixture

```
test/fixtures/
├── empty-repo/          # 刚 git init 的空仓库
├── simple-project/      # 含几个源文件的仓库
└── scripts/
    └── create-fixture.ts
```

集成测试在 `beforeEach` 中复制 fixture 到临时目录，执行后清理。

### 13.3 关键测试用例

```typescript
describe("snap", () => {
  it("creates stage-001 relative to git HEAD");
  it("creates stage-002 relative to stage-001");
  it("does not modify git status");
  it("deduplicates unchanged file blobs");
});

describe("merge", () => {
  it("merges contiguous pending stages");
  it("rejects non-contiguous stages");
  it("rejects committed stages");
  it("marks source stages as merged");
});

describe("commit", () => {
  it("applies cumulative diff to worktree");
  it("warns on dirty worktree without --force");
  it("marks stage as committed");
});
```

---

## 14. 构建与发布

### 14.1 构建流程

```bash
# 主包
tsup src/index.ts src/cli/index.ts --format esm --dts

# 扩展
cd extension && esbuild src/extension.ts --bundle --outdir=dist --external:vscode
```

### 14.2 发布

仓库：https://github.com/hiraras/stages

| 产物 | 目标 | 命令 |
|------|------|------|
| `stages` CLI | npm | `npm publish` |
| Stages 扩展 | VS Marketplace + Open VSX | `vsce publish` / `ovsx publish` |

### 14.3 版本策略

- MVP 阶段：`0.x.y` 语义化版本
- CLI 和扩展**同版本号**，扩展依赖 `"stages": "^0.1.0"`

---

## 15. 安全考量

| 项 | 措施 |
|----|------|
| 路径遍历 | manifest 中的 path 禁止 `..` 前缀，还原时校验在项目根内 |
| 命令注入 | git subprocess 使用参数数组，不拼接 shell 字符串 |
| 数据完整性 | blob 写入后校验 SHA-256 |
| 并发安全 | meta.json 写入使用原子写（write temp + rename） |

---

## 16. 开发排期（建议）

| 阶段 | 内容 | 预估 |
|------|------|------|
| **P1** | 项目脚手架、core/store（blob + meta + manifest） | 2 天 |
| **P2** | core/diff 引擎 + core/stage（create、list、show） | 2 天 |
| **P3** | CLI 全部命令 | 1 天 |
| **P4** | core/stage（merge、commit、hide） | 2 天 |
| **P5** | VS Code 扩展（SCM + Virtual FS + diff） | 3 天 |
| **P6** | 测试 + 文档 + 发布 | 2 天 |
| **合计** | | **~12 天** |

---

## 17. 后续演进（非 MVP）

| 方向 | 说明 |
|------|------|
| 迁移 monorepo | 拆出 `@stages/core` 独立包 |
| `.stagesignore` | 自定义忽略规则 |
| `stages revert` | 非破坏性回滚到某 stage 状态 |
| 按文件采纳 | 选择性 apply stage 中的部分文件 |
| MCP server | 供 AI agent 调用 `stages snap` |
| 迁移到 monorepo | 当包数量 > 2 时考虑 |

---

## 18. 技术栈确认记录

| # | 决策项 | 确认结果 |
|---|--------|----------|
| 1 | 仓库结构 | 传统单包 + extension 子目录（非 monorepo） |
| 2 | Diff 引擎 | git subprocess |
| 3 | 快照存储 | 内容寻址 blob + manifest |
| 4 | 扩展集成 | 扩展直接 import stages core API |
| 5 | CLI 框架 | commander |
| 6 | 测试框架 | Vitest |
