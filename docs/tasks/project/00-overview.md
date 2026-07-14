# Stages 任务总览

> 进度：[process.md](./process.md)  
> 基于：[requirements.md](../../requirements.md) · [business-flow.md](../../business-flow.md) · [features/](../../features/) · [system-design.md](../../system-design.md)  
> 说明：任务状态自旧 `docs/process.md` **迁移**，未在建立本库时逐项核码；以 docs2 文档链为准做后续跟踪。

## 阶段划分

| 阶段 | 名称 | 任务文件 | 状态 |
|------|------|----------|------|
| P0 | 项目脚手架 | [p0-scaffold.md](./p0-scaffold.md) | ✅ |
| P1 | 存储层 | [p1-store.md](./p1-store.md) | ✅ |
| P2 | Diff + Snap | [p2-diff-snap.md](./p2-diff-snap.md) | ✅ |
| P3 | CLI | [p3-cli.md](./p3-cli.md) | ✅ |
| P4 | 生命周期 | [p4-lifecycle.md](./p4-lifecycle.md) | ✅ |
| P5 | VS Code 扩展 | [p5-extension.md](./p5-extension.md) | ✅ |
| P6 | 质量 / 文档 / 发布 | [p6-quality-release.md](./p6-quality-release.md) | 🔵 |

## 依赖关系

```
P0 → P1 → P2 → P3
              ↘
               P4 → P5 → P6
```

- P3 与 P4 可部分并行，但 merge/commit/drop 的 CLI 接线依赖 P4 Core。  
- P5 依赖 StagesAPI（P3/P4）稳定。  
- P6 可随时补测试；发布依赖功能闭环。

## 全量任务索引

| ID | 任务 | 阶段 | 优先级 |
|----|------|------|--------|
| P0-01 ~ P0-05 | 脚手架与测试基建 | P0 | P0 |
| P1-01 ~ P1-08 | blob/meta/manifest/scanner/cycle | P1 | P0 |
| P2-01 ~ P2-08 | diff + init/snap | P2 | P0 |
| P3-01 ~ P3-09 | CLI 命令树与接线 | P3 | P0 |
| P4-01 ~ P4-09 | merge/commit/drop/rename/log/verify | P4 | P0 |
| P5-01 ~ P5-09 | SCM / URI / 交互 | P5 | P0 |
| P6-01 ~ P6-10 | 验收、文档、发布 | P6 | P1 |

详见各阶段文件内 checkbox。
