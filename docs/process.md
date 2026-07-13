# Stages 开发进度

> 最后更新：2026-07-12  
> 任务清单：[tasks/](./tasks/)

---

## 总体进度

| 阶段 | 名称 | 任务数 | 完成 | 进度 | 状态 |
|------|------|--------|------|------|------|
| P0 | 项目初始化 | 5 | 5 | 100% | ✅ 已完成 |
| P1 | 存储层 | 8 | 8 | 100% | ✅ 已完成 |
| P2 | Diff 引擎 + Stage 创建 | 9 | 9 | 100% | ✅ 已完成 |
| P3 | CLI 命令 | 10 | 10 | 100% | ✅ 已完成 |
| P4 | Merge / Commit / 生命周期 | 10 | 10 | 100% | ✅ 已完成 |
| P5 | VS Code 扩展 | 10 | 10 | 100% | ✅ 已完成 |
| P6 | 测试 / 文档 / 发布 | 8 | 6 | 75% | 🔵 进行中 |
| **合计** | | **60** | **58** | **97%** | |

---

## 当前阶段

**P6 — 发布**（npm / Open VSX 待手动执行）

---

## 阶段日志

### P0 — 项目初始化 ✅

| ID | 任务 | 状态 | 完成日期 | 备注 |
|----|------|------|----------|------|
| P0-01 | 初始化 package.json、tsconfig、tsup 配置 | ✅ 已完成 | 2026-07-11 | |
| P0-02 | 搭建 src/ 目录结构 | ✅ 已完成 | 2026-07-11 | |
| P0-03 | 配置 Vitest 测试环境 | ✅ 已完成 | 2026-07-11 | |
| P0-04 | 创建 test/fixtures 测试仓库 | ✅ 已完成 | 2026-07-11 | 使用 createSimpleProject 规避 Windows 中文路径 cpSync 问题 |
| P0-05 | 编写 README 骨架 | ✅ 已完成 | 2026-07-11 | |

### P1 — 存储层 ✅

| ID | 任务 | 状态 | 完成日期 | 备注 |
|----|------|------|----------|------|
| P1-01 ~ P1-08 | 全部存储层任务 | ✅ 已完成 | 2026-07-11 | blob / manifest / meta / id / scanner |

### P2 — Diff 引擎 + Stage 创建 ✅

| ID | 任务 | 状态 | 完成日期 | 备注 |
|----|------|------|----------|------|
| P2-01 ~ P2-09 | 全部 Diff + Create 任务 | ✅ 已完成 | 2026-07-11 | git subprocess diff |

### P3 — CLI 命令 ✅

| ID | 任务 | 状态 | 完成日期 | 备注 |
|----|------|------|----------|------|
| P3-01 ~ P3-10 | 全部 CLI 任务 | ✅ 已完成 | 2026-07-11 | commander 命令树；`-m` 解析前拦截避免与 commit 冲突 |

### P4 — Merge / Commit / 生命周期 ✅

| ID | 任务 | 状态 | 完成日期 | 备注 |
|----|------|------|----------|------|
| P4-01 ~ P4-10 | 全部生命周期任务 | ✅ 已完成 | 2026-07-11 | StagesAPI 已暴露 |

### P5 — VS Code 扩展 ✅

| ID | 任务 | 状态 | 完成日期 | 备注 |
|----|------|------|----------|------|
| P5-01 ~ P5-09 | 基础扩展 | ✅ 已完成 | 2026-07-11 | SCM + stages:// ContentProvider + vsix |
| P5-10 | Commit 历史展示 | ✅ 已完成 | 2026-07-12 | readCommitFile / getPrevCommitId + SCM commit groups |

### P6 — 测试 / 文档 / 发布

| ID | 任务 | 状态 | 完成日期 | 备注 |
|----|------|------|----------|------|
| P6-01 | 补齐验收标准集成测试 | ✅ 已完成 | 2026-07-11 | acceptance/cli + extension.md |
| P6-02 | 性能验证 | ✅ 已完成 | 2026-07-11 | Windows 8s / Unix 2s |
| P6-03 | 安全校验 | ✅ 已完成 | 2026-07-11 | path/blob/meta/特殊字符 |
| P6-04 | 完善 README 与使用文档 | ✅ 已完成 | 2026-07-11 | 扩展 + 发布说明 |
| P6-05 | 配置 npm publish | ✅ 已完成 | 2026-07-11 | .npmignore + prepublishOnly |
| P6-06 | 构建扩展 vsix 包 | ✅ 已完成 | 2026-07-11 | stages-vscode-0.1.0.vsix |
| P6-07 | 发布到 npm | ⬜ 待开始 | | 需 npm 账号 |
| P6-08 | 发布到 Open VSX | ⬜ 待开始 | | 需 ovsx token |

---

## 验收标准进度

### CLI（requirements §12.1）

- [x] npx stages 生成 stage-001，不改变 git status
- [x] 多次 stages 后 list 显示所有 stage
- [x] stages show 2 仅显示 stage1 → stage2 增量 diff
- [x] stages merge 1 2 成功，list 只显示重命名后的第一个 stage
- [x] 合并非连续 stage 报错
- [x] 合并已提交 stage 报错
- [x] stages rename 修改未提交 stage 名称
- [x] stages list --all 可查看含已 commit 的 stage 元数据
- [x] stages commit -m 提交当前 cycle，创建 commit 节点，重置 stage ID
- [x] stages log 查看 commit 历史
- [x] stages verify 构建前门禁检查
- [x] stages show 1 数字简写匹配当前 cycle stage
- [x] stages show commit-001 / c1 查看相邻 commit 增量 diff
- [x] commit show 支持 --stat，--open 暂不支持
- [x] stages -m 与 stages commit -m 无 Commander 冲突
- [x] 脏工作区 commit 需 --force（CLI 层检测 + 覆盖行为已验证）
- [x] stages init 初始化；工作区有改动时自动创建第一个 stage
- [x] commit 后 git add + git commit 正常

### VS Code / Cursor 扩展（requirements §12.2）

- [x] 扩展项目结构与 vsix 打包
- [x] SCM 面板 Stages 区域（代码已实现）
- [x] stage 文件树 M/A/D 展示
- [x] 点击文件打开 diff 视图
- [x] meta.json 监听自动刷新
- [x] Rename 命令
- [ ] 手动验收（见 test/acceptance/extension.md）
- [ ] Cursor 兼容性手动验证

---

## 变更记录

| 日期 | 变更 |
|------|------|
| 2026-07-10 | 创建任务清单和进度文件，共 59 项任务 |
| 2026-07-11 | commit 重构为 cycle 提交；新增 log/verify；init 自动 stage；merge 就地合并 |
| 2026-07-11 | 修复 `-m` 选项冲突（snap 解析前拦截）；明确 `--force` 覆盖未 stage 改动 |
| 2026-07-11 | 新增 `stages show commit-001` / `c1` 查看 commit diff；`show 1` 匹配当前 cycle |
| 2026-07-12 | 修复 stages -m 后面板消失：折叠分组用占位项保持 SCM 可见；移除 SourceControl 重建 |
| 2026-07-12 | 扩展 SCM：刷新性能优化；角标不计 Stages 文件数 |

---

## 状态图例

| 标记 | 含义 |
|------|------|
| ⬜ 待开始 | 尚未开始 |
| 🔵 进行中 | 正在开发 |
| ✅ 已完成 | 开发完成并验证 |
| ⏸️ 暂停 | 暂时搁置 |
| ❌ 取消 | 不再需要 |
