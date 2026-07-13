# Stages

在 VS Code / Cursor 的 **Source Control** 面板中查看和审查跨会话的代码 stage，配合 [Stages CLI](https://www.npmjs.com/package/stages) 使用。

Stages 是独立于 `git add` 的暂存层：多次 AI 对话后分批保存改动、审查 diff、合并 stage，最终一次性提交到 Git。

## 功能

- **Unstaged Changes**：显示工作区相对最新 stage 的未保存改动（有改动时置顶，默认展开）
- **Stage 列表**：当前 cycle 的 stage，按时间 **新 → 旧** 排列
- **Commit 历史**：与 `stages log` 一致，按时间 **新 → 旧** 排列
- **Show Files / Hide Files**：stage 与 commit 默认只显示标题，点击展开文件列表
- **Diff 查看**：点击文件打开左右对比视图
- **Rename**：右键 pending / ready 的 stage 可重命名
- **自动刷新**：`stages -m` / `stages commit` 后自动更新；编辑工作区文件后 Unstaged 区域自动更新

Stages 的文件变更**不计入** Source Control 角标，角标仅反映 Git 变更数。

## 前置条件

1. 项目中已初始化 Stages（存在 `.stages/meta.json`）
2. 已安装 Stages CLI：

```bash
npm install -g stages
stages init
```

扩展检测到 `.stages/meta.json` 时自动激活。

## 使用

### 面板结构

```
Source Control → Stages
├── Unstaged Changes [N]        ← 有未 stage 改动时显示
├── 3 权限改造 [pending]        ← 点 Show Files 查看文件
├── 1 auth 模块改造 [pending]
├── 2 权限模块 [commit]
└── 1 auth 模块改造 [commit]
```

### 典型工作流

```
AI 改代码 → stages -m "描述" → 在扩展中审查 diff
         → stages merge 1 2 --name "模块名"（可选）
         → stages commit -m "模块名" → git add && git commit
```

### Diff 语义

| 类型 | 左侧（旧） | 右侧（新） |
|------|-----------|-----------|
| Unstaged | 最新 stage / baseline | 工作区文件 |
| Stage | 上一 stage / git HEAD | 当前 stage |
| Commit | 上一 commit / baseline | 当前 commit |

## 命令

| 命令 | 说明 |
|------|------|
| `Stages: Refresh` | 手动刷新面板 |
| `Stages: Show Files` | 展开分组文件列表 |
| `Stages: Hide Files` | 收起分组文件列表 |
| `Stages: Rename Stage` | 重命名 stage |

## 常见问题

**看不到 Stages 面板？**

- 确认项目根目录存在 `.stages/meta.json`（先运行 `stages init`）
- 打开 Source Control 面板，在仓库列表中选择 **Stages**
- 执行 `Stages: Refresh` 或 Reload Window

**`stages -m` 后看不到新 stage？**

- 等待 1 秒内自动刷新，或点击 Refresh
- 新 stage 排在列表最上方（Unstaged 之下）

## 相关链接

- 项目仓库：[github.com/hiraras/stages](https://github.com/hiraras/stages)
- CLI 包：[stages on npm](https://www.npmjs.com/package/stages)
- 扩展源码：[extension/](https://github.com/hiraras/stages/tree/main/extension)

## License

MIT — 见 [LICENSE.md](https://github.com/hiraras/stages/blob/main/extension/LICENSE.md)
