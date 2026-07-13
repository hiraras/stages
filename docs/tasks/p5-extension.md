# P5 — VS Code / Cursor 扩展

> 预估：3 天  
> 前置依赖：P4（StagesAPI 可用）  
> 产出：可在 VS Code / Cursor 中查看 stage diff 的扩展

---

## P5-01 初始化 extension/ 项目结构

**描述：** 创建扩展子项目。

**交付物：**
```
extension/
├── package.json          # "stages": "file:.."
├── tsconfig.json
├── src/
│   ├── extension.ts      # activate / deactivate
│   ├── scm/
│   ├── fs/
│   └── commands/
└── .vscodeignore
```

**extension/package.json 关键配置：**
```json
{
  "name": "stages-vscode",
  "publisher": "...",
  "engines": { "vscode": "^1.85.0" },
  "activationEvents": ["workspaceContains:.stages/meta.json"],
  "contributes": {
    "scm": { ... },
    "commands": [ ... ]
  },
  "dependencies": {
    "stages": "file:.."
  }
}
```

**验收标准：**
- [ ] 扩展可在 VS Code 开发宿主中加载
- [ ] 检测到 .stages/ 时自动激活
- [ ] 能 import stages core API

---

## P5-02 实现 StagesFileSystemProvider

**描述：** `stages://` 虚拟文件系统，供 diff 视图读取 stage 文件内容。

**文件：** `extension/src/fs/stagesFs.ts`

**URI 格式：**
```
stages://stage-001/src/auth/login.ts
stages://stage-auth/src/auth/register.ts
```

**接口：**
```typescript
class StagesFileSystemProvider implements vscode.FileSystemProvider {
  stat(uri: vscode.Uri): vscode.FileStat
  readFile(uri: vscode.Uri): Uint8Array
  // 只读，不实现 writeFile
}
```

**验收标准：**
- [ ] 注册 scheme: `stages`
- [ ] 通过 stages API readFile() 读取 blob 内容
- [ ] 文件不存在时抛出 FileNotFound
- [ ] 支持 stat 返回文件大小和时间

---

## P5-03 实现 StagesSCMProvider 侧边栏

**描述：** 在 Source Control 区域注册 Stages 面板。

**文件：** `extension/src/scm/stagesProvider.ts`

**设计：**
```
Source Control 面板
├── Git (原有，不变)
└── Stages (新增)
    ├── stage-003 权限改造 [pending]
    ├── stage-auth auth 模块改造 [ready]
    └── ...
```

**实现：**
```typescript
class StagesSCMProvider implements vscode.Disposable {
  private scm: vscode.SourceControl;
  private groups: Map<string, vscode.SourceControlResourceGroup>;

  refresh(): Promise<void>  // 从 stages API 读取 list
  private createGroup(stage: StageEntry): void
}
```

**验收标准：**
- [ ] 在 SCM 面板显示 "Stages" 区域
- [ ] 每个 stage 显示为一个 ResourceGroup
- [ ] Group 标题格式：`{name} [{status}]`
- [ ] 合并 stage 显示 mergedFrom 信息

---

## P5-04 实现 stage 文件树展示

**描述：** 展开 stage 显示变更文件列表。

**文件：** `extension/src/scm/stagesProvider.ts`（扩展）

**展开策略：**

- **Unstaged Changes** 置顶，有改动时默认展开（`api.listUnstaged()`）
- stage / commit 默认只显示标题；点击 **Show Files** 加载文件列表，**Hide Files** 收起
- 展开状态仅当前会话有效，重开 IDE 后 stage/commit 全部收起
- 新增 stage / Unstaged 始终排在面板最上方

**文件状态标记：**
| 标记 | 含义 |
|------|------|
| M | 修改 |
| A | 新增 |
| D | 删除 |

**实现：**
```typescript
// 每个 changed 文件创建一个 Resource
const resource = new vscode.SourceControlResourceState(
  vscode.Uri.parse(`stages://${stageId}/${filePath}`),
  filePath,
  status  // M/A/D
);
```

**验收标准：**
- [ ] stage 列表顺序为新 → 旧
- [ ] 点击 Show Files 后显示文件列表
- [ ] 文件显示正确的 M/A/D 标记
- [ ] 仅显示该 stage 增量变更的文件（非全部文件）

---

## P5-05 实现点击文件打开 vscode.diff

**描述：** 点击文件打开左右对比 diff 视图。

**文件：** `extension/src/scm/stagesProvider.ts`（扩展）

**流程：**
```
用户点击 stage-auth 下的 src/auth/login.ts
  │
  ├─ 确定左侧：prev stage 的 stages:// URI（或空文件）
  ├─ 确定右侧：当前 stage 的 stages:// URI
  └─ vscode.diff(leftUri, rightUri, "{stageName}: {fileName}")
```

**首个 stage 特殊处理：**
- 左侧：从 git HEAD 读取（通过 core API）
- 或左侧使用空的 stages://baseline/ URI

**验收标准：**
- [ ] 点击文件打开 diff editor
- [ ] 左侧为上一版本，右侧为当前 stage 版本
- [ ] diff 标题显示 stage 名称和文件名
- [ ] 新增文件左侧为空
- [ ] 删除文件右侧为空

---

## P5-06 实现 meta.json 文件监听与自动刷新

**描述：** 监听 .stages/meta.json 变化，自动刷新面板。

**文件：** `extension/src/extension.ts`

**实现：**
```typescript
const watcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(workspaceRoot, '.stages/meta.json')
);
watcher.onDidChange(() => scmProvider.refresh());
watcher.onDidCreate(() => scmProvider.refresh());
```

**验收标准：**
- [ ] CLI 执行 `stages` 后，扩展面板在 1 秒内自动刷新
- [ ] 手动刷新按钮也可用
- [ ] 无 .stages/ 时不启动 watcher

---

## P5-07 实现右键 Rename 命令

**描述：** 在 SCM 面板右键 stage 可重命名。

**文件：** `extension/src/commands/rename.ts`

**流程：**
```
1. 右键 stage → "Rename Stage"
2. 弹出 InputBox 预填当前名称
3. 调用 stages API rename()
4. 刷新面板
```

**验收标准：**
- [ ] 右键菜单显示 Rename 选项
- [ ] 仅 pending / ready 状态可重命名
- [ ] 重命名后面板立即更新

---

## P5-08 ~~隐藏 committed stage 过滤逻辑~~（已移除）

**原描述：** 默认不显示 hidden 的 committed stage；通过 `stages.showHidden` 设置控制。

**现状：** `hide` / `unhide` 命令与 `stages.showHidden` 配置已移除。扩展面板当前 cycle 仅显示活跃 stage；历史审查由 **commit 列表**（`stages log`）承担。`hidden` 字段仍用于内部（merge 吸收、commit 后归档）。

---

## P5-09 扩展手动测试与 Cursor 兼容性验证

**描述：** 在 VS Code 和 Cursor 中进行手动测试。

**测试清单：**
- [ ] VS Code 中安装扩展，打开含 .stages/ 的项目
- [ ] 侧边栏正确显示 stage 列表
- [ ] 点击文件打开 diff 视图，内容正确
- [ ] CLI 新增 stage 后扩展自动刷新
- [ ] Cursor 中安装扩展（从 vsix 或 Open VSX）
- [ ] Cursor 中功能与 VS Code 一致
- [ ] 右键 Rename 正常工作
- [ ] 无 .stages/ 的项目不显示 Stages 面板

---

## P5-10 扩展展示 Commit 历史

**描述：** SCM 面板除当前 cycle stage 外，展示 `stages log` 中的 commit 记录，支持点击文件查看与 CLI 一致的 diff。

**前置依赖：** P5-03 ~ P5-06（SCM Provider 与 ContentProvider 已就绪）

**涉及文件：**
- `extension/src/scm/stagesProvider.ts` — SCM Provider stage + commit + unstaged
- `extension/src/fs/stagesFs.ts` — 支持 `stages://commit-001/<path>` URI
- `src/core/stage/lifecycle.ts` 或新模块 — `readCommitFile`、`getPrevCommitId`（若 Core 尚无）

**设计要点（见 requirements §5.2.5）：**

```
Source Control: Stages
├── Unstaged Changes [N]        ← api.listUnstaged()，有改动时置顶
├── stage-002 ... [ready]       ← api.list()，newest first
├── stage-001 ... [pending]
├── commit-002 ... [commit]     ← api.log()，newest first
└── commit-001 ... [commit]
```

**Commit diff 左/右 URI：**

| 场景 | 左侧 | 右侧 |
|------|------|------|
| commit-001 | `stages://baseline/<path>` | `stages://commit-001/<path>` |
| commit-00N | `stages://commit-00(N-1)/<path>` | `stages://commit-00N/<path>` |

**验收标准：**
- [x] 执行 `stages commit` 后面板出现对应 commit group
- [x] commit group 标题含序号、名称、`[commit]`
- [x] 展开 commit 显示 M/A/D 变更文件（增量，非全量 manifest）
- [x] commit 默认折叠，展开后 Loading → 文件列表
- [x] 点击文件 diff 内容与 `stages show commit-001` 一致
- [x] commit-001 首个 commit 左侧为 git HEAD 基线
- [x] commit 无 Rename 右键菜单
- [x] `stages commit` / meta.json 变更后 1 秒内自动刷新
- [x] 无 commit 时仅显示 stage，不出现空 commit 区域

**待确认（requirements §5.2.5）：** 已全部确认并实现（E1–E5）。

---

## P5-11 扩展 Drop stage 命令

**描述：** SCM 面板右键 pending / ready stage 可执行 drop，语义与 CLI 一致。

**前置依赖：** Core `drop()` API（见 [stage-drop.md](../features/stage-drop.md)）

**涉及文件：**
- `extension/src/commands/drop.ts` — 确认对话框 + 调用 Core API
- `extension/src/scm/stagesProvider.ts` — 注册右键菜单
- `extension/package.json` — 命令与菜单贡献点

**交互：**
1. 右键 stage → "Drop stage…"
2. 对话框展示：将删除的 stage 列表（含序号 ≥ N 的所有 stage，含 ID 空洞）、恢复目标
3. 确认后执行 drop，刷新 SCM 面板

**验收标准：**
- [x] pending / ready stage 显示 Drop 菜单项
- [x] committed stage 不显示 Drop
- [x] drop 3 时对话框列出 stage-003、004、005（或含 stage-006 等空洞 ID）
- [x] 取消对话框不修改数据
- [x] 成功后工作区与 CLI `stages drop` 一致
- [x] meta.json 变更后自动刷新面板
- [x] 不匹配历史 cycle 中 committed 的同名 stage

