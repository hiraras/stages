# VS Code / Cursor 扩展验收清单

> 手动测试项，对应 requirements §12.2

## 安装

- [ ] `cd extension && npm run package` 生成 `.vsix`
- [ ] VS Code: `Extensions: Install from VSIX`
- [ ] Cursor: 从 Open VSX 或 VSIX 安装

## 基础功能 — Unstaged

- [ ] stage 后修改工作区文件，Source Control → **Stages** 最上方出现 **Unstaged Changes [N]**
- [ ] Unstaged 默认展开，显示 M/A/D 文件
- [ ] 点击文件打开 diff：左 = 最新 stage，右 = 工作区
- [ ] 工作区与最新 stage 一致时，不显示 Unstaged 分组
- [ ] 编辑/保存工作区文件后 unstaged 列表自动更新

## 基础功能 — Stage

- [ ] 打开含 `.stages/meta.json` 的项目后扩展自动激活
- [ ] Source Control 面板出现 **Stages** 区域
- [ ] stage 列表顺序为 **新 → 旧**
- [ ] stage 默认只显示标题，点 **Show Files** 后显示 M/A/D 文件
- [ ] 点击文件打开 `vscode.diff`，左右内容正确
- [ ] 执行 `stages -m` 后新 stage 出现在列表**最上方**（Unstaged 之下）

## 基础功能 — Commit

- [ ] 执行 `stages commit` 后出现 commit 分组
- [ ] commit 标题格式：`{序号} {name} [commit]`
- [ ] commit 列表顺序与 `stages log` 一致（新 → 旧）
- [ ] commit 默认只显示标题，点 **Show Files** 后显示文件列表
- [ ] 点击 commit 文件 diff 与 `stages show commit-001` 一致
- [ ] commit 无 Rename 菜单

## 展开状态与排序

- [ ] 当前会话内 Show Files 展开状态保持，Hide Files 可收起
- [ ] **重开 IDE** 后所有 stage/commit 恢复为收起（仅标题）
- [ ] Unstaged 在重开 IDE 后仍默认展开（有改动时）
- [ ] 分组顺序：Unstaged → stage（新→旧）→ commit（新→旧）

## 联动与配置

- [ ] CLI 执行 `stages -m "..."` 后 1 秒内视图自动刷新
- [ ] 视图标题栏 Refresh 按钮可用
- [ ] 右键 stage 分组 → Rename Stage 可重命名 pending stage

## 兼容性

- [ ] VS Code 中功能正常
- [ ] Cursor 中功能正常
- [ ] 无 `.stages/` 的项目不显示 Stages 区域
