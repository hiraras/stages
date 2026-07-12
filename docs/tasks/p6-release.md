# P6 — 测试 / 文档 / 发布

> 预估：2 天  
> 前置依赖：P3 + P4 + P5  
> 产出：可发布的 npm 包 + VS Code 扩展

---

## P6-01 补齐验收标准对应的集成测试

**描述：** 按 requirements §12 验收标准编写完整测试。

**文件：** `test/acceptance/`

**CLI 验收测试：**
- [ ] npx stages 生成 stage-001，不改变 git status
- [ ] 多次 stages 后 list 显示所有 stage
- [ ] stages show 2 仅显示 stage1 → stage2 增量 diff
- [ ] stages merge 1 2 成功，list 只显示重命名后的第一个 stage
- [ ] 合并非连续 stage 报错
- [ ] 合并已提交 stage 报错
- [ ] stages rename 修改未提交 stage 名称
- [ ] stages commit 应用改动到工作区，标记 committed
- [ ] 脏工作区 commit 需 --force
- [ ] stages hide 隐藏，list --all 可查看
- [ ] stages init 初始化，首次 stages 自动初始化
- [ ] commit 后 git add + git commit 正常

**扩展验收（手动测试清单归档到 test/acceptance/extension.md）：**
- [ ] 侧边栏显示 stage 列表
- [ ] 有未 stage 改动时显示 Unstaged 节点；stage/commit 展开后懒加载
- [ ] 点击文件打开 diff 视图
- [ ] CLI 新增 stage 后扩展自动刷新
- [ ] Cursor 中正常运行

---

## P6-02 性能验证

**描述：** 验证关键操作的性能指标。

**文件：** `test/performance/benchmark.test.ts`

**指标：**
| 操作 | 目标 | 条件 |
|------|------|------|
| snap | < 2s | 100 个文件 |
| list | < 100ms | 50 个 stage |
| show diff | < 1s | 10 个变更文件 |
| 扩展刷新 | < 500ms | meta.json 变更后 |

**验收标准：**
- [ ] snap 100 文件 < 2s（含 blob 去重）
- [ ] 性能测试在 CI 中可运行（允许一定波动）
- [ ] 未达标时记录并分析瓶颈

---

## P6-03 安全校验

**描述：** 验证安全防护措施。

**测试用例：**
- [ ] 路径遍历：manifest 含 `../../etc/passwd` 时被拒绝
- [ ] blob 完整性：篡改 blob 文件后读取报错
- [ ] 命令注入：含特殊字符的文件名不导致 git 命令失败
- [ ] 原子写入：meta.json 写入中断不损坏已有数据

---

## P6-04 完善 README 与使用文档

**描述：** 编写面向用户的使用文档。

**交付物：**
- `README.md` 完善：
  - 安装方式（npm / npx）
  - 快速开始（5 分钟上手）
  - 完整命令参考
  - 跨会话组批提交示例
  - VS Code 扩展安装与使用
  - 常见问题

**验收标准：**
- [ ] README 包含完整使用示例
- [ ] 包含 CLI + 扩展配合使用的 workflow 图
- [ ] 中文文档（面向中文用户）

---

## P6-05 配置 npm publish

**描述：** 确保 npm 包可正确发布和安装。

**检查清单：**
- [ ] `package.json` files 字段仅包含 dist/ 和 bin/
- [ ] exports 正确配置
- [ ] bin 字段指向 bin/stages.js
- [ ] engines: `{ "node": ">=18" }`
- [ ] .npmignore 排除 src/、test/、extension/
- [ ] `npm pack` 检查包内容
- [ ] `npx stages --version` 在安装后正常工作

---

## P6-06 构建扩展 vsix 包

**描述：** 打包 VS Code 扩展。

**步骤：**
```bash
cd extension
npm run build        # esbuild 打包
vsce package         # 生成 .vsix
```

**验收标准：**
- [ ] 生成 stages-vscode-x.x.x.vsix
- [ ] 可通过 `code --install-extension` 安装
- [ ] 扩展内 stages 依赖指向 npm 版本（非 file:..）
- [ ] 扩展 package.json 中版本与主包一致

---

## P6-07 发布到 npm

**描述：** 发布 CLI 包到 npm registry。

**步骤：**
```bash
npm run build
npm test
npm publish --access public
```

**验收标准：**
- [ ] `npm install -g stages` 后 `stages --help` 正常
- [ ] `npx stages` 可运行
- [ ] 版本号为 0.1.0

---

## P6-08 发布到 Open VSX

**描述：** 发布扩展到 Open VSX Registry（Cursor 可用）。

**步骤：**
```bash
ovsx publish stages-vscode-x.x.x.vsix
```

**验收标准：**
- [ ] 扩展在 Open VSX 可搜索到
- [ ] Cursor 中可从扩展市场安装
- [ ] 安装后功能正常
