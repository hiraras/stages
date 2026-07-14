# P5 — VS Code / Cursor 扩展

> 状态：✅ 已完成（自旧进度迁移；含原 P5-10 Commit 历史）  
> Feature：[ide-scm](../../features/ide-scm.md) · 设计 §7.3

| ID | 任务 | 关联 | 状态 |
|----|------|------|------|
| P5-01 | extension 工程与 `stages` file: 依赖 | 设计 §3.1 | ✅ |
| P5-02 | Stages SCM Provider 注册 | ide-scm | ✅ |
| P5-03 | Unstaged 分组（默认展开）+ 左右 diff | ide-scm | ✅ |
| P5-04 | 当前 cycle stage 分组（新→旧）+ Show/Hide Files | ide-scm | ✅ |
| P5-05 | Commit 历史分组（新→旧）+ 标题格式 | ide-scm · log | ✅ |
| P5-06 | `stages://` ContentProvider（stage/commit/baseline） | ide-scm · show | ✅ |
| P5-07 | meta / 工作区监听刷新；分组顺序重建 | ide-scm | ✅ |
| P5-08 | Rename / Drop 命令与确认（仅未提交） | rename · drop | ✅ |
| P5-09 | vsix 构建配置 | 设计 §8 | ✅ |

## 验收要点

- [x] 三区顺序与 diff 语义对齐 CLI
- [x] committed 无 Rename/Drop
- [ ] 手动验收清单（见 P6 / `test/acceptance/extension.md`）
- [ ] Cursor 兼容性手动验证（见 P6）
