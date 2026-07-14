# Stages

跨会话的代码改动确认与组批工具——独立于 `git add` 的暂存层，让你在多次 AI 对话后分批保存、审查、合并，最终一次性提交。

仓库：[github.com/hiraras/stages](https://github.com/hiraras/stages)

## 安装

```bash
npm install -g stages
# 或
npx stages <command>
```

要求：Node.js >= 18，项目为 git 仓库。

## 快速开始

```bash
# 初始化（工作区相对 HEAD 有改动时自动创建第一个 stage）
stages init

# 保存当前改动为一个 stage（首次也可省略 init，会自动初始化）
stages -m "登录改造"

# 查看当前 cycle 的 stage 列表
stages list

# 查看 stage 增量 diff（数字简写仅匹配当前 cycle）
stages show 1
stages show 2 --stat
stages show 2 --open          # 调起编辑器 diff

# 合并连续未提交 stage（就地合并到第一个 ID 并重命名）
stages merge 1 2 --name "auth 模块改造"

# 提交当前 cycle：应用快照到工作区，归档 stage，ID 从 001 重置
stages commit -m "auth 模块改造"

# 查看 stages commit 历史与相邻增量
stages log
stages show commit-001
stages show c1 --stat

# 丢弃当前 cycle 中序号 ≥ N 的未提交 stage，并还原工作区
stages drop 3 --yes

# 构建前检查（可写入 build 脚本）
stages verify

# 应用到工作区后，自行 git commit
git add .
git commit -m "feat: auth module"
```

**注意：**

- `stages -m` 保存 stage；`stages commit -m` 将**当前 cycle** 应用到工作区并归档（**不**执行 `git commit`）
- 每次 `stages commit` 后 stage ID **从 `stage-001` 重新计数**；`show` / `merge` / `rename` / `drop` 的数字简写只作用于**当前 cycle**
- `stages commit` / `drop` 在有未 stage 改动时默认拒绝；`--force` 会用目标快照**覆盖**这些改动
- 工作区与最新 stage 一致时，`stages -m` 提示 `No new changes.`
- 可选 `.stagesignore`（语法同 gitignore），与 `.gitignore` 一并约束 snap 范围

## VS Code / Cursor 扩展

```bash
npm run package:extension
code --install-extension extension/stages-vscode-0.1.0.vsix
# 或 Cursor：从扩展面板安装 VSIX
```

检测到 `.stages/meta.json` 时激活；未初始化时会提示先执行 `stages init`。在 **Source Control** 中选择 **Stages**：

| 区域 | 说明 |
|------|------|
| Unstaged Changes | 工作区相对最新 stage / cycle baseline；有改动时置顶并默认展开 |
| Stage 列表 | 当前 cycle，新 → 旧；Show Files / Hide Files（收起状态不跨会话） |
| Commit 历史 | 同 `stages log`，新 → 旧 |

- 点击文件打开 diff（语义对齐 CLI）
- 右键未提交 stage：Rename / Drop；commit 只读；扩展内**不**执行 merge / commit（用 CLI）
- 修改工作区或 CLI 变更后会自动刷新

详见 [extension/README.md](./extension/README.md)。手动验收：[test/acceptance/extension.md](./test/acceptance/extension.md)。

## 命令参考

| 命令 | 说明 |
|------|------|
| `stages` / `stages -m "msg"` | 保存当前改动为 stage |
| `stages init` | 初始化 `.stages/` |
| `stages list [--all]` | 列出 stage（`--all` 含隐藏/历史元数据） |
| `stages status` | 项目概况 |
| `stages show <id> [--stat] [--open]` | stage 或 commit diff（commit 不支持 `--open`） |
| `stages merge <ids…> --name <n>` | 合并连续未提交 stage |
| `stages rename <id> <name>` | 重命名未提交 stage |
| `stages commit -m "msg" [--force]` | 提交当前 cycle 到工作区 |
| `stages drop <id> [--yes] [--force]` | 删除序号 ≥ N 的未 commit stage 并还原工作区 |
| `stages log` | stages commit 历史 |
| `stages verify` | 构建前门禁 |

**show ID：** stage 用 `1` / `stage-001`（数字 = 当前 cycle）；commit 用 `commit-001` / `c1`。

## 跨会话工作流

```
AI 改代码 → stages -m "描述" → 扩展/CLI 审查 diff
         → stages merge 1 2 --name "模块名"（可选）
         → stages commit -m "模块名" → git add && git commit
```

## 文档

产品规格与实现说明在 **`docs2/`**（分层文档）：

| 文档 | 内容 |
|------|------|
| [docs2/requirements.md](./docs2/requirements.md) | 需求 |
| [docs2/business-flow.md](./docs2/business-flow.md) | 流程总纲 |
| [docs2/features/](./docs2/features/) | 各流程细则 |
| [docs2/system-design.md](./docs2/system-design.md) | 系统设计 |
| [docs2/tasks/project/](./docs2/tasks/project/) | 任务与 [进度](./docs2/tasks/project/process.md) |

旧版 `docs/` 仅作历史参考，以 `docs2/` 为准。

## 开发

```bash
npm install
npm run build
npm test
npm run build:extension
```

## 发布

```bash
npm run build:prod
npm test
npm pack
npm publish --access public

cd extension && npm run package
npx vsce publish   # 需 vsce login
npx ovsx publish   # 可选：Open VSX
```

## License

MIT
