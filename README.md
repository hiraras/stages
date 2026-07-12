# Stages

跨会话的代码改动确认与组批工具——独立于 `git add` 的暂存层，让你在多次 AI 对话后分批保存、审查、合并，最终一次性提交。

## 安装

```bash
npm install -g stages
```

## 快速开始

```bash
# 初始化（工作区有改动时自动创建第一个 stage）
stages init

# 保存当前改动为一个 stage
stages -m "登录改造"

# 查看 stage 列表
stages list

# 查看 stage 增量 diff（数字简写匹配当前 cycle）
stages show 1

# 查看 commit 历史
stages log

# 查看 commit 改动（相邻 commit 之间的增量）
stages show commit-001
stages show c1 --stat

# 合并连续 stage（就地合并到第一个并重命名）
stages merge 1 2 --name "auth 模块改造"

# 提交当前 cycle（自动合并所有 stage，重置 ID）
stages commit -m "auth 模块改造"

# 构建前检查（可写入 build 脚本）
stages verify

# 应用到工作区后，自行 git commit
git add .
git commit -m "feat: auth module"
```

**注意：**

- `stages -m` 与 `stages commit -m` 含义不同：前者保存 stage，后者提交当前 cycle
- `stages commit` 会将最新 stage 快照**写回工作区**；若工作区有未 stage 的改动，需先 `stages -m "描述"` 保存，或使用 `--force`（**会覆盖**未 stage 的改动）
- 工作区与最新 stage 一致时，`stages -m` 会提示 `No new changes.`

## VS Code / Cursor 扩展

```bash
# 构建并打包扩展
npm run package:extension

# VS Code 安装
code --install-extension extension/stages-vscode-0.1.0.vsix
```

扩展在检测到 `.stages/meta.json` 时自动激活，在 **Source Control** 面板显示 **Stages** 区域：

- **Unstaged Changes**（最上方）：工作区相对最新 stage 的未 stage 改动，默认展开；无改动时不显示
- stage 列表（**新 → 旧**）与 commit 历史，默认只显示标题；**重开 IDE 后全部收起**，需重新点 **Show Files**
- 点击分组旁 **Show Files** 查看变更文件，**Hide Files** 收起
- 新增 stage / Unstaged 分组始终排在最上方（Unstaged 第一，其次最新 stage）
- 无 Unstaged 且全部收起时，底部显示一行提示（保持面板可见）
- 点击文件打开 diff 视图
  - unstaged：左 = 最新 stage / baseline，右 = 工作区文件
  - stage：左 = 上一 stage / git HEAD，右 = 当前 stage
  - commit：语义同 `stages show commit-001`
- 编辑工作区文件后 Unstaged 区域自动更新；`stages -m` / `stages commit` 后全量刷新
- 右键 stage 可 Rename（仅 pending / ready）；commit 只读
- 设置 `stages.showHidden: true` 显示已隐藏的 archived stage

手动验收清单见 [test/acceptance/extension.md](./test/acceptance/extension.md)。

## 命令参考

| 命令 | 说明 |
|------|------|
| `stages` / `stages -m "msg"` | 保存当前改动为 stage |
| `stages list [--all]` | 列出 stage |
| `stages show <id> [--stat] [--open]` | 查看 stage 或 commit diff |
| `stages merge <ids> --name <n>` | 合并连续 stage |
| `stages rename <id> <name>` | 重命名 stage |
| `stages commit -m "msg" [--force]` | 提交当前 cycle 到工作区 |
| `stages log` | 查看 commit 历史 |
| `stages verify` | 构建前门禁 |
| `stages hide/unhide <id>` | 隐藏/显示 committed stage |

**show ID 格式：** stage 用 `1` / `stage-001`；commit 用 `commit-001` / `c1`。

## 跨会话工作流

```
AI 改代码 → stages -m "描述" → 扩展/CLI 审查 diff
         → stages merge 1 2 --name "模块名"（可选）
         → stages commit -m "模块名" → git add && git commit
```

## 开发

```bash
npm install
npm run build
npm test
npm run build:extension   # 构建 VS Code 扩展
```

## 发布

```bash
npm run build:prod
npm test
npm pack                  # 检查 CLI 包内容
npm publish --access public

cd extension && npm run package
# ovsx publish stages-vscode-0.1.0.vsix
```

## 文档

- [需求文档](./docs/requirements.md)
- [系统设计](./docs/system-design.md)
- [任务清单](./docs/tasks/00-overview.md)
- [开发进度](./docs/process.md)
