# P0 — 项目脚手架

> 状态：✅ 已完成（自旧进度迁移）  
> 设计：[system-design.md](../../system-design.md) §2–3  
> 进度：[process.md](./process.md)

| ID | 任务 | 关联 | 状态 |
|----|------|------|------|
| P0-01 | 初始化 package.json、tsconfig、tsup | 设计 §2 | ✅ |
| P0-02 | 搭建 `src/core|cli|types` 与 `bin/` 目录 | 设计 §3 | ✅ |
| P0-03 | 配置 Vitest | 设计 §8 | ✅ |
| P0-04 | 创建 `test/fixtures`（含 Windows 路径注意事项） | 设计 §8 | ✅ |
| P0-05 | README 骨架 | P6 完善 | ✅ |

## 验收要点

- [x] `pnpm/npm` 可安装、TypeScript 可构建
- [x] Vitest 可跑空套件 / fixture 可生成临时 git 仓库
