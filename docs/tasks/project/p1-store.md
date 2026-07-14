# P1 — 存储层

> 状态：✅ 已完成（自旧进度迁移）  
> 设计：[system-design.md](../../system-design.md) §5  
> Features：[init](../../features/init.md) · [snap](../../features/snap.md)

| ID | 任务 | 关联 | 状态 |
|----|------|------|------|
| P1-01 | Blob 读写与 SHA-256 分目录去重 | 设计 §5.2 | ✅ |
| P1-02 | Manifest 读写（path → hash/mode） | 设计 §5.3 | ✅ |
| P1-03 | meta.json 读写与原子写 | 设计 §5.4 | ✅ |
| P1-04 | Stage ID / `nextId` 生成（cycle 内递增） | req §3.1 | ✅ |
| P1-05 | `commitId` / 当前 cycle 过滤辅助 | req §3.1 · 设计 §5.4 | ✅ |
| P1-06 | baseline + `baselineManifestPath` 字段 | commit feature | ✅ |
| P1-07 | Scanner：fast-glob + `.gitignore` | snap | ✅ |
| P1-08 | Scanner：`.stagesignore`（MVP） | req §2.4 · snap | ✅ |

## 验收要点

- [x] 未改文件跨 stage 共享 blob
- [x] meta 损坏风险可通过原子写缓解
- [x] 忽略规则生效（含 stagesignore）
