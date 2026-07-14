# P6 — 质量 / 文档 / 发布

> 状态：🔵 进行中（自旧进度迁移 + docs2 文档步骤）  
> 设计 §8–9 · requirements §7

| ID | 任务 | 关联 | 状态 |
|----|------|------|------|
| P6-01 | 验收向集成测试（CLI） | req §7 · features | ✅ |
| P6-02 | 性能粗测（snap 量级） | req §6.1 | ✅ |
| P6-03 | 安全校验（path/blob/meta） | 设计 §7.4 | ✅ |
| P6-04 | README 与使用说明完善 | 发布 | ✅ |
| P6-05 | npm publish 配置（ignore / prepublish） | 设计 §8.2 | ✅ |
| P6-06 | 构建扩展 vsix | 设计 §8.2 | ✅ |
| P6-07 | 发布到 npm | 设计 §8.2 | ⬜ |
| P6-08 | 发布到 Open VSX（及/或 Marketplace） | 设计 §8.2 | ⬜ |
| P6-09 | 扩展手动验收 + Cursor 兼容性 | ide-scm · 旧 acceptance | ⬜ |
| P6-10 | docs2 文档链落盘（req→flow→features→design→tasks） | new-system-dev | ✅ |

## 验收要点（checklist）

### CLI（原则见 requirements §7）

- [x] snap / list / show / merge / rename / commit / drop / init / log / verify 主路径
- [x] cycle：数字简写、commit 后 ID 重置、list --all
- [x] 脏工作区 `--force`；`-m` 无冲突

### 扩展

- [x] SCM + diff + 刷新 + Rename（代码侧）
- [ ] 按 `test/acceptance/extension.md` 手动勾选
- [ ] Cursor 内手动验证

### 发布

- [ ] npm 上可 `npx stages`
- [ ] 扩展商店/Open VSX 可安装

---

## 备注

- P6-10 完成日：2026-07-14（`docs2/` 体系）；原 `docs/` 保留未改。  
- 发布任务需人工账号/token，代理仅维护清单状态。
