# P3 — CLI 命令

> 预估：1 天  
> 前置依赖：P2（基础命令）、P4（完整命令）  
> 产出：完整的 `stages` CLI 工具

> **注意：** P3 分两轮实现。P2 完成后实现基础命令（snap/init/list/show/status），P4 完成后补充 merge/commit/rename/hide 命令。

---

## P3-01 搭建 commander 命令树

**描述：** 注册所有子命令和全局选项。

**文件：** `src/cli/index.ts`

**命令树：**
```
stages [snap] [-m <msg>]       # 默认命令（-m 解析前拦截，避免与 commit 冲突）
stages init
stages list [--all]
stages show <id> [--stat] [--open]
stages merge <ids...> --name <n>
stages rename <id> <name>
stages commit -m <msg> [--force]
stages log
stages verify
stages hide <id>
stages unhide <id>
stages status
```

> **实现说明：** 根命令与 `commit` 子命令均使用 `-m`。默认 snap 在 Commander 解析前拦截 `process.argv` 并手动解析 `-m`；子命令由 Commander 正常处理。

**验收标准：**
- [ ] `stages --help` 显示所有命令
- [ ] 各子命令 `--help` 正确
- [ ] 全局选项：`--version`

---

## P3-02 实现 `stages` / `stages snap` 命令

**描述：** 默认命令，创建新 stage。

**文件：** `src/cli/commands/snap.ts`

```bash
npx stages                  # 自动生成名称
npx stages -m "登录改造"    # 指定名称
npx stages snap -m "..."    # 显式子命令
```

**输出示例：**
```
✓ Created stage-001 "登录改造"
  5 files changed (+120, -30)
```

**验收标准：**
- [ ] 无参数时执行 snap
- [ ] -m 设置 stage 名称，无 -m 时自动生成（如 "stage-001" 或时间戳）
- [ ] 输出文件数和 stats

---

## P3-03 实现 `stages init` 命令

**描述：** 手动初始化项目。

**文件：** `src/cli/commands/init.ts`

**输出示例：**
```
✓ Initialized stages in /path/to/project
  Baseline: abc1234 (main)
  Added .stages/ to .gitignore
```

**验收标准：**
- [ ] 调用 core init()
- [ ] 已初始化时提示 "Already initialized"

---

## P3-04 实现 `stages list` 命令

**描述：** 表格形式列出所有 stage。

**文件：** `src/cli/commands/list.ts`

**输出示例：**
```
ID         名称           状态       时间                 变更
stage-001  auth 模块改造   pending    2026-07-10 09:00    8 files (+200/-40)
stage-003  权限改造       pending    2026-07-10 11:00    4 files (+50/-5)
```

**验收标准：**
- [ ] 默认不显示 hidden / merged stage
- [ ] `--all` 显示包括 hidden 和 merged 的所有 stage
- [ ] 表格对齐，中文名称正确显示

---

## P3-05 实现 `stages show` 命令

**描述：** 终端输出 stage diff。

**文件：** `src/cli/commands/show.ts`

```bash
stages show 2              # 完整 diff
stages show stage-002      # 支持完整 ID
stages show 2 --stat       # 仅统计
```

**验收标准：**
- [ ] 支持短号（"2"）和完整 ID（"stage-002"）
- [ ] 默认输出 unified diff 到终端
- [ ] `--stat` 仅显示文件列表和 stats
- [ ] 无变更时提示 "No changes"

---

## P3-06 实现 `stages show --open` 调起编辑器

**描述：** 调起 VS Code / Cursor 的 diff 视图。

**文件：** `src/cli/commands/show.ts`（扩展）

**实现：**
```
1. 将 old/new 内容写入临时文件
2. 检测编辑器：cursor > code > $EDITOR
3. 执行：{editor} --diff tmp/old tmp/new
```

**验收标准：**
- [ ] 优先使用 `cursor` 命令
- [ ] fallback 到 `code` 命令
- [ ] 编辑器不可用时给出明确提示
- [ ] 临时文件使用后清理

---

## P3-07 实现 `stages status` 命令

**描述：** 显示当前项目 stages 概况。

**文件：** `src/cli/commands/status.ts`

**输出示例：**
```
Stages Status
  Baseline: abc1234 (main)
  Total stages: 4 (2 pending, 1 ready, 1 committed)
  Latest: stage-003 "权限改造" (pending, 2026-07-10 11:00)
```

**验收标准：**
- [ ] 显示 baseline commit
- [ ] 按状态统计 stage 数量
- [ ] 显示最新 stage 信息

---

## P3-08 实现统一错误处理与输出格式

**描述：** CLI 层统一的错误处理和输出风格。

**文件：** `src/cli/utils/`

| 文件 | 功能 |
|------|------|
| `errors.ts` | 错误码映射为用户友好消息 |
| `output.ts` | 彩色输出、表格格式化 |
| `project.ts` | 获取 projectRoot + 传递给 core |

**错误输出示例：**
```
✗ Error: Cannot merge non-contiguous stages (stage-001, stage-003)
  Stages must be consecutive. Did you mean: stage-001, stage-002?
```

**验收标准：**
- [ ] 所有 core 错误码有对应 CLI 消息
- [ ] 非零退出码
- [ ] 成功操作输出 ✓ 前缀

---

## P3-09 实现 bin/stages.js 入口

**描述：** npm bin 入口文件。

**文件：** `bin/stages.js`

```javascript
#!/usr/bin/env node
import '../dist/cli/index.js';
```

**验收标准：**
- [ ] `npx stages --version` 输出版本号
- [ ] `npx stages --help` 正常工作
- [ ] package.json bin 字段正确配置

---

## P3-10 CLI 集成测试

**描述：** 通过子进程调用 CLI 进行端到端测试。

**文件：** `test/cli/`

**测试用例：**
- [ ] `stages init` 在 fixture 仓库成功
- [ ] `stages` 创建 stage 并输出摘要
- [ ] `stages list` 显示创建的 stage
- [ ] `stages show 1 --stat` 输出统计
- [ ] `stages status` 输出概况
- [ ] 非 git 目录执行报错
- [ ] 无效 stage ID 报错
