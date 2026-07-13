# P5 / P6 实现完成 — 2026-07-11

## P5 VS Code 扩展

| ID | 任务 | 状态 |
|----|------|------|
| P5-01 | extension/ 项目结构 | ✅ |
| P5-02 | stages:// 虚拟文档 ContentProvider | ✅ |
| P5-03 | StagesSCMProvider 侧边栏 | ✅ |
| P5-04 | stage 文件树 M/A/D | ✅ |
| P5-05 | 点击打开 vscode.diff | ✅ |
| P5-06 | meta.json 监听自动刷新 | ✅ |
| P5-07 | Rename 命令 | ✅ |
| P5-08 | ~~showHidden 配置~~（已移除） | — |
| P5-09 | 手动测试清单 | 📋 test/acceptance/extension.md |

**构建：** `npm run package:extension` → `extension/stages-vscode-0.1.0.vsix`

## P6 测试 / 文档 / 发布

| ID | 任务 | 状态 |
|----|------|------|
| P6-01 | 验收集成测试 | ✅ test/acceptance/cli.test.ts |
| P6-02 | 性能验证 | ✅ test/performance/benchmark.test.ts（Windows 放宽阈值） |
| P6-03 | 安全校验 | ✅ test/security/security.test.ts |
| P6-04 | README 完善 | ✅ |
| P6-05 | npm publish 配置 | ✅ .npmignore + prepublishOnly |
| P6-06 | vsix 打包 | ✅ |
| P6-07 | 发布 npm | ⬜ 待手动执行 |
| P6-08 | 发布 Open VSX | ⬜ 待手动执行 |
