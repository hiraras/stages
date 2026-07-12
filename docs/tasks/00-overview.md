# Stages 任务总览

> 基于 [requirements.md](../requirements.md) 和 [system-design.md](../system-design.md)  
> 进度追踪见 [process.md](../process.md)

---

## 阶段划分

| 阶段 | 名称 | 预估 | 任务文件 | 状态 |
|------|------|------|----------|------|
| P0 | 项目初始化 | 0.5 天 | [p0-init.md](./p0-init.md) | ⬜ 未开始 |
| P1 | 存储层 | 2 天 | [p1-store.md](./p1-store.md) | ⬜ 未开始 |
| P2 | Diff 引擎 + Stage 创建 | 2 天 | [p2-diff-create.md](./p2-diff-create.md) | ⬜ 未开始 |
| P3 | CLI 命令 | 1 天 | [p3-cli.md](./p3-cli.md) | ⬜ 未开始 |
| P4 | Merge / Commit / 生命周期 | 2 天 | [p4-lifecycle.md](./p4-lifecycle.md) | ⬜ 未开始 |
| P5 | VS Code 扩展 | 3 天 | [p5-extension.md](./p5-extension.md) | ⬜ 未开始 |
| P6 | 测试 / 文档 / 发布 | 2 天 | [p6-release.md](./p6-release.md) | ⬜ 未开始 |

**合计：约 12.5 天**

---

## 任务依赖关系

```
P0 项目初始化
 └─► P1 存储层
      └─► P2 Diff + Create
           ├─► P3 CLI（基础命令）
           └─► P4 Merge / Commit / Lifecycle
                ├─► P3 CLI（完整命令）
                └─► P5 VS Code 扩展
                     └─► P6 测试 / 发布
```

---

## 全量任务索引

### P0 — 项目初始化（5 项）

| ID | 任务 | 优先级 |
|----|------|--------|
| P0-01 | 初始化 package.json、tsconfig、tsup 配置 | P0 |
| P0-02 | 搭建 src/ 目录结构（core / cli / types） | P0 |
| P0-03 | 配置 Vitest 测试环境 | P0 |
| P0-04 | 创建 test/fixtures 测试仓库 | P0 |
| P0-05 | 编写 README 骨架 | P1 |

### P1 — 存储层（8 项）

| ID | 任务 | 优先级 |
|----|------|--------|
| P1-01 | 定义 TypeScript 类型（StageEntry、Manifest、Meta） | P0 |
| P1-02 | 实现 blob 存储（SHA-256 + 分目录） | P0 |
| P1-03 | 实现 manifest 读写 | P0 |
| P1-04 | 实现 meta.json 读写（原子写入） | P0 |
| P1-05 | 实现 stage ID 自增生成器 | P0 |
| P1-06 | 实现文件扫描器（fast-glob + ignore） | P0 |
| P1-07 | 实现项目根目录发现 | P0 |
| P1-08 | 存储层单元测试 | P0 |

### P2 — Diff 引擎 + Stage 创建（9 项）

| ID | 任务 | 优先级 |
|----|------|--------|
| P2-01 | 实现 git subprocess 封装（head、diff） | P0 |
| P2-02 | 实现 manifest 对比（文件增删改检测） | P0 |
| P2-03 | 实现临时目录还原 + git diff --no-index | P0 |
| P2-04 | 实现增量 diff 解析（resolveIncremental） | P0 |
| P2-05 | 实现累计 diff 解析（resolveCumulative） | P0 |
| P2-06 | 实现 stats 计算（additions/deletions） | P1 |
| P2-07 | 实现 stage create（snap）流程 | P0 |
| P2-08 | 实现 init 初始化流程 | P0 |
| P2-09 | Diff + Create 集成测试 | P0 |

### P3 — CLI 命令（10 项）

| ID | 任务 | 优先级 |
|----|------|--------|
| P3-01 | 搭建 commander 命令树 | P0 |
| P3-02 | 实现 `stages` / `stages snap` 命令 | P0 |
| P3-03 | 实现 `stages init` 命令 | P0 |
| P3-04 | 实现 `stages list` 命令 | P0 |
| P3-05 | 实现 `stages show` 命令（含 --stat） | P0 |
| P3-06 | 实现 `stages show --open` 调起编辑器 | P1 |
| P3-07 | 实现 `stages status` 命令 | P1 |
| P3-08 | 实现统一错误处理与输出格式 | P0 |
| P3-09 | 实现 bin/stages.js 入口 | P0 |
| P3-10 | CLI 集成测试 | P0 |

### P4 — Merge / Commit / 生命周期（10 项）

| ID | 任务 | 优先级 |
|----|------|--------|
| P4-01 | 实现 merge 校验（连续性、状态） | P0 |
| P4-02 | 实现 merge 执行（manifest 合并 + 元数据） | P0 |
| P4-03 | 实现 `stages merge` CLI 命令 | P0 |
| P4-04 | 实现脏工作区检测 | P0 |
| P4-05 | 实现 commit 应用到工作区 | P0 |
| P4-06 | 实现 `stages commit` CLI 命令（含 --force） | P0 |
| P4-07 | 实现 rename / hide / unhide | P0 |
| P4-08 | 实现对应 CLI 命令 | P0 |
| P4-09 | 暴露 StagesAPI 公共接口 | P0 |
| P4-10 | 生命周期集成测试 | P0 |

### P5 — VS Code 扩展（9 项）

| ID | 任务 | 优先级 |
|----|------|--------|
| P5-01 | 初始化 extension/ 项目结构 | P0 |
| P5-02 | 实现 StagesFileSystemProvider（stages:// URI） | P0 |
| P5-03 | 实现 StagesSCMProvider 侧边栏 | P0 |
| P5-04 | 实现 stage 文件树展示 | P0 |
| P5-05 | 实现点击文件打开 vscode.diff | P0 |
| P5-06 | 实现 meta.json 文件监听与自动刷新 | P0 |
| P5-07 | 实现右键 Rename 命令 | P1 |
| P5-08 | 隐藏 committed stage 过滤逻辑 | P1 |
| P5-09 | 扩展手动测试与 Cursor 兼容性验证 | P0 |

### P6 — 测试 / 文档 / 发布（8 项）

| ID | 任务 | 优先级 |
|----|------|--------|
| P6-01 | 补齐验收标准对应的集成测试 | P0 |
| P6-02 | 性能验证（snap < 2s / 100 文件） | P1 |
| P6-03 | 安全校验（路径遍历、blob 完整性） | P0 |
| P6-04 | 完善 README 与使用文档 | P0 |
| P6-05 | 配置 npm publish（files、exports、bin） | P0 |
| P6-06 | 构建扩展 vsix 包 | P0 |
| P6-07 | 发布到 npm | P1 |
| P6-08 | 发布到 Open VSX（Cursor 可用） | P1 |

---

## 验收标准映射

| 验收项（requirements §12） | 对应任务 |
|---------------------------|----------|
| npx stages 生成 stage-001，不改变 git status | P2-07, P3-02, P6-01 |
| stages list 显示所有 stage | P3-04, P6-01 |
| stages show 增量 diff | P2-04, P3-05, P6-01 |
| stages merge 连续 stage | P4-01, P4-02, P4-03, P6-01 |
| 合并非连续 / 已提交报错 | P4-01, P6-01 |
| stages rename | P4-07, P4-08, P6-01 |
| stages commit 应用到工作区 | P4-05, P4-06, P6-01 |
| 脏工作区需 --force | P4-04, P4-06, P6-01 |
| stages hide / list --all | P4-07, P4-08, P6-01 |
| stages init / 自动初始化 | P2-08, P3-03, P6-01 |
| 扩展侧边栏 + diff | P5-03, P5-05, P5-09 |
| CLI 新增后扩展自动刷新 | P5-06, P5-09 |
