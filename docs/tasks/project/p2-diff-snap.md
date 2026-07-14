# P2 — Diff 引擎 + Snap / Init

> 状态：✅ 已完成（自旧进度迁移）  
> Features：[init](../../features/init.md) · [snap](../../features/snap.md) · [show](../../features/show.md)  
> 设计：[system-design.md](../../system-design.md) §5.5、§6

| ID | 任务 | 关联 | 状态 |
|----|------|------|------|
| P2-01 | git subprocess Diff 引擎封装 | 设计 §5.5 | ✅ |
| P2-02 | manifest 级变更列表（A/M/D） | show | ✅ |
| P2-03 | `resolveIncremental` / 累计语义 | show · req §5.5 | ✅ |
| P2-04 | `resolveCommit`（相邻 commit） | show · log | ✅ |
| P2-05 | `stages init`（gitignore、baseline、可选首 stage） | init | ✅ |
| P2-06 | `snap` / create stage（无改动不建空 stage） | snap | ✅ |
| P2-07 | 首次 snap 自动等效 init | init · snap | ✅ |
| P2-08 | stats（增删行）计算 | snap · list | ✅ |

## 验收要点

- [x] snap 不改 git index
- [x] `No new changes.` 行为
- [x] 首 stage 相对 baseline；后续相对上一 stage
