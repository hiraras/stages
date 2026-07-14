# P3 — CLI 命令

> 状态：✅ 已完成（自旧进度迁移）  
> Features：各 CLI slug · 设计 §7.2

| ID | 任务 | 关联 | 状态 |
|----|------|------|------|
| P3-01 | commander 命令树与项目根发现 | 设计 §7.2 | ✅ |
| P3-02 | 默认 snap：`-m` 解析前拦截（避免与 commit 冲突） | snap · commit | ✅ |
| P3-03 | `init` / `status` / `list` / `list --all` | init · list-status | ✅ |
| P3-04 | `show`：数字/stage/commit 路由、`--stat`、stage `--open` | show | ✅ |
| P3-05 | `merge` / `rename` CLI 接线 | merge · rename | ✅ |
| P3-06 | `commit -m` / `--force` CLI | commit | ✅ |
| P3-07 | `drop` / `--yes` / `--force` CLI | drop | ✅ |
| P3-08 | `log` / `verify` CLI | log · verify | ✅ |
| P3-09 | 错误码与用户可读输出 | 设计 §5.6 | ✅ |

## 验收要点

- [x] `stages -m` 与 `stages commit -m` 无冲突
- [x] `show 1` 仅当前 cycle；`show c1` 为 commit
- [x] verify 退出码可供脚本使用
