# Stages

在 VS Code / Cursor 的 **Source Control** 面板中查看和审查跨会话的代码 stage，配合 [Stages CLI](https://www.npmjs.com/package/stages) 使用。

Stages 是独立于 `git add` 的暂存层：多次 AI 对话后分批保存改动、审查 diff、合并 stage，最终一次性提交到 Git。

## 功能

- **Unstaged Changes**：工作区相对最新 stage（或新 cycle 的 baseline）的未 stage 改动；有改动时置顶并默认展开
- **Stage 列表**：仅**当前 cycle**，按时间 **新 → 旧**
- **Commit 历史**：与 `stages log` 一致，**新 → 旧**
- **Show Files / Hide Files**：stage / commit 默认只显示标题；展开状态仅当前会话有效
- **Diff 查看**：点击文件打开左右对比（与 CLI 语义对齐）
- **Rename / Drop**：右键 pending / ready 的 stage；commit 只读
- **自动刷新**：监听 `.stages/meta.json` 与工作区文件变更；已打开的 Stages diff 会尽量随刷新失效重载

扩展内**不提供** merge / commit（请用 CLI）。Stages 的文件变更**不计入** Source Control 角标。

## 前置条件

1. 已安装 Stages CLI（`npm install -g stages` 或使用仓库本地包）
2. 在项目中执行过 `stages init`（存在 `.stages/meta.json`）

扩展检测到 `.stages/meta.json` 时激活；若工作区已打开但尚未 init，会提示先运行 `stages init`。

## 使用

### 面板结构

```
Source Control → Stages
├── Unstaged Changes [N]        ← 有未 stage 改动时显示
├── 3 权限改造 [pending]        ← Show Files 查看文件
├── 1 auth 模块改造 [pending]
├── 2 权限模块 [commit]
└── 1 auth 模块改造 [commit]
```

### 典型工作流

```
AI 改代码 → stages -m "描述" → 在扩展中审查 diff
         → stages merge 1 2 --name "模块名"（可选，CLI）
         → stages commit -m "模块名" → git add && git commit
```

### Diff 语义

| 类型 | 左侧（旧） | 右侧（新） |
|------|-----------|-----------|
| Unstaged | 最新 stage，或无 stage 时的 **cycle baseline** | 工作区 |
| Stage | 上一 stage；cycle 内第一个为 **cycle baseline** | 当前 stage |
| Commit（最老 / `commit-001`） | **初始 git HEAD**（`meta.baseline`） | 该 commit 快照 |
| Commit（其后） | 上一 stages commit | 当前 commit |

> cycle baseline：最近一次 `stages commit` 的快照（尚无 commit 时对齐初始 HEAD 语义）。勿与「最老 commit 左侧的 git HEAD」混淆。

## 命令

| 命令 | 说明 |
|------|------|
| `Stages: Refresh` | 手动刷新面板 |
| `Stages: Show Files` | 展开分组文件列表 |
| `Stages: Hide Files` | 收起分组文件列表 |
| `Stages: Rename Stage` | 重命名未提交 stage |
| `Stages: Drop Stage…` | 丢弃序号 ≥ 该 stage 的未提交项并还原工作区（含确认） |

## 本地开发 / 安装 VSIX

在仓库根目录：

```bash
npm run package:extension
code --install-extension extension/stages-vscode-0.1.0.vsix
```

## 常见问题

**看不到 Stages 面板？**

- 确认项目根存在 `.stages/meta.json`（先 `stages init`）
- 打开 Source Control，在仓库列表中选择 **Stages**
- 执行 `Stages: Refresh` 或 Reload Window

**`stages -m` 后看不到新 stage？**

- 等待自动刷新，或点 Refresh
- 新 stage 在 Unstaged 之下、列表最上（新 → 旧）

**最老 commit 的 diff 看起来不对？**

- 左侧应为**当时仓库的 git HEAD**，不是最近一次 stages commit；语义与 `stages show commit-001` 一致

## 文档

完整规格见仓库 [`docs2/`](https://github.com/hiraras/stages/tree/main/docs2)（需求、流程、扩展细则 [ide-scm](https://github.com/hiraras/stages/blob/main/docs2/features/ide-scm.md)）。

## 相关链接

- 项目仓库：[github.com/hiraras/stages](https://github.com/hiraras/stages)
- CLI 包：[stages on npm](https://www.npmjs.com/package/stages)
- 扩展源码：[extension/](https://github.com/hiraras/stages/tree/main/extension)

## License

MIT — 见 [LICENSE.md](https://github.com/hiraras/stages/blob/main/extension/LICENSE.md)
