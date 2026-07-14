# P4 — Merge / Commit / Drop / 生命周期

> 状态：✅ 已完成（自旧进度迁移）  
> Features：[merge](../../features/merge.md) · [commit](../../features/commit.md) · [drop](../../features/drop.md) · [rename](../../features/rename.md) · [log](../../features/log.md) · [verify](../../features/verify.md)

| ID | 任务 | 关联 | 状态 |
|----|------|------|------|
| P4-01 | merge：连续校验 + 就地写最后 manifest | merge | ✅ |
| P4-02 | merge：merged 隐藏 + prev 重指向 | merge | ✅ |
| P4-03 | commit：应用快照、建 commit、归档 `commitId` | commit | ✅ |
| P4-04 | commit：重置 `nextId`、更新 `baselineManifestPath` | commit · §3.1 | ✅ |
| P4-05 | commit/drop：脏工作区检测与 `--force` | commit · drop | ✅ |
| P4-06 | drop：按序号截断、空洞、id+createdAt、不回收 nextId | drop | ✅ |
| P4-07 | rename（仅 pending/ready） | rename | ✅ |
| P4-08 | log + verify Core | log · verify | ✅ |
| P4-09 | 暴露完整 StagesAPI | 设计 §7.1 | ✅ |

## 验收要点

- [x] 非连续 / 已提交 merge 拒绝
- [x] commit 后 stage ID 从 001；跨 cycle 同名不影响 drop
- [x] drop 恢复工作区到正确目标
