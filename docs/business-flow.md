# 业务流程总纲

> 基于：[requirements.md](./requirements.md)  
> 状态：已确认  
> 细则：每条流程对应 `docs2/features/{slug}.md`（一对一）  
> 说明：本文只含索引与短主路径；参数、错误码、存储字段见各 feature。

---

## 作用域约定（阅读总纲前必读）

- 每次 **`stages commit` 成功后，stage ID 从 `stage-001` 重置**，跨 cycle 会出现相同 ID。
- 下文凡写「stage」「数字简写」「merge / rename / drop」，**默认仅指当前 cycle**（见 [requirements §3.1](./requirements.md)）。
- **历史 stage** 已归档到 commit：不参与默认 list / 写入类操作；审查走 `log` + `show commit-*` 或 `list --all`。
- 各 feature 须再次声明本流程作用域，避免与历史同名 ID 混淆。

---

## 流程索引

| 流程 | slug | 一句话 | 细则 | 状态 |
|------|------|--------|------|------|
| 初始化 | `init` | 建立存储并写入 baseline stages commit | [features/init.md](./features/init.md) | ✅ |
| 保存 stage | `snap` | 把工作区改动存为新 stage | [features/snap.md](./features/snap.md) | ✅ |
| 列表与概况 | `list-status` | 查看 stage 列表与项目概况 | [features/list-status.md](./features/list-status.md) | ✅ |
| 查看 diff | `show` | 看 stage / commit 的差异 | [features/show.md](./features/show.md) | ✅ |
| 合并 stage | `merge` | 连续未提交 stage 就地合并并命名 | [features/merge.md](./features/merge.md) | ✅ |
| 重命名 | `rename` | 修改未提交 stage 名称 | [features/rename.md](./features/rename.md) | ✅ |
| 提交到工作区 | `commit` | 应用快照、归档 cycle、更新 baseline | [features/commit.md](./features/commit.md) | ✅ |
| 丢弃 stage | `drop` | 截断删除未提交 stage 并恢复工作区 | [features/drop.md](./features/drop.md) | ✅ |
| Commit 历史 | `log` | 查看 stages commit 历史 | [features/log.md](./features/log.md) | ✅ |
| 构建门禁 | `verify` | 未清完 stage/脏改动则失败 | [features/verify.md](./features/verify.md) | ✅ |
| IDE 审查 | `ide-scm` | 侧栏查看 Unstaged / stage / commit | [features/ide-scm.md](./features/ide-scm.md) | ✅ |

---

## 流程正文

### 初始化（`init`）

**触发：** 执行 `stages init`（可选 `-m`）；或首次执行 `stages`（snap）且尚未初始化。

**主路径（摘要）：**

1. 确认当前目录为 git 仓库  
2. 创建 `.stages/` 与初始元数据；将 `.stages/` 写入 `.gitignore`（若尚未存在）  
3. 记录当前 git HEAD 为 `meta.baseline`  
4. 扫描工作区 → 写入 **init stages commit**（默认名 `init`，可用 `-m`）；设置 `baselineManifestPath`；**不**建 stage、**不**改工作区  

**结果 / 副作用：** 已有 baseline commit；空 cycle 可开始 snap；已初始化则提示并跳过。

**相关需求：** [requirements.md](./requirements.md) §3#10、§5.1 init、§5.3  

**细则：** [features/init.md](./features/init.md)  

**相关流程：** 常衔接 [snap](./features/snap.md)；首条 commit 见 [log](./features/log.md) / [show](./features/show.md)。

---

### 保存 stage（`snap`）

**触发：** 开发者审查一批工作区改动后，执行 `stages` / `stages snap`（可选 `-m` / `--message`）。

**主路径（摘要）：**

1. 若未初始化，执行等效于 `init` 的操作  
2. 相对 cycle baseline（无 stage）或上一 stage 快照采集工作区；遵守 `.gitignore` 与 `.stagesignore`  
3. 无新改动 → 提示 `No new changes.` 并退出，不建空 stage  
4. 有改动 → 写入新的 `stage-00N`（pending）并输出摘要  

**结果 / 副作用：** 新增只读快照；**不**修改工作区内容与 git index。

**相关需求：** [requirements.md](./requirements.md) §2.2、§3#1–2、§5.1 snap、§2.4（`.stagesignore`）  

**细则：** [features/snap.md](./features/snap.md)  

**相关流程：** [show](./features/show.md)、[list-status](./features/list-status.md)、[ide-scm](./features/ide-scm.md)。

---

### 列表与概况（`list-status`）

**触发：** `stages list`、`stages list --all` 或 `stages status`。

**主路径（摘要）：**

1. 读取元数据  
2. `list`：展示当前可见 stage（**新 → 旧**；merged 默认隐藏；`--all` 含历史/隐藏）  
3. `status`：输出项目 stages 概况  

**结果 / 副作用：** 只读；不改变存储与工作区。

**相关需求：** [requirements.md](./requirements.md) §5.1 list / status  

**细则：** [features/list-status.md](./features/list-status.md)  

**相关流程：** 展示结果受 [merge](./features/merge.md)、[commit](./features/commit.md)、[drop](./features/drop.md) 影响。

---

### 查看 diff（`show`）

**触发：** `stages show <stage|commit>`（可选 `--stat`；stage 可选 `--open`）。

**主路径（摘要）：**

1. 解析目标 ID（数字简写仅匹配**当前 cycle** 的 stage）  
2. 按需求语义计算 diff（stage 增量/合并累计；commit 相邻增量）  
3. 输出到终端，或（stage + `--open`）调起编辑器 diff  

**结果 / 副作用：** 只读。

**相关需求：** [requirements.md](./requirements.md) §5.1 show、§5.5  

**细则：** [features/show.md](./features/show.md)  

**相关流程：** [snap](./features/snap.md)、[commit](./features/commit.md)、[ide-scm](./features/ide-scm.md)。

---

### 合并 stage（`merge`）

**触发：** `stages merge <id…> --name <name>`。

**主路径（摘要）：**

1. 校验目标均为当前 cycle 未提交、非 merged，且 ID **连续**  
2. **就地合并**：保留第一个 stage 的 ID；写入**最后一个** stage 的 manifest；名称改为 `--name`  
3. 其余标记 `merged` 并默认隐藏；后续 stage 的 prev 重指向保留的 stage  

**结果 / 副作用：** 默认 list 只见合并后的保留 stage；不改工作区与 git。

**相关需求：** [requirements.md](./requirements.md) §3#5–6、§5.1 merge  

**细则：** [features/merge.md](./features/merge.md)  

**相关流程：** [rename](./features/rename.md)、[show](./features/show.md)、[commit](./features/commit.md)。

---

### 重命名（`rename`）

**触发：** `stages rename <id> <new-name>`，或扩展对未提交 stage 的 Rename。

**主路径（摘要）：**

1. 校验目标为 pending / ready（未 committed）  
2. 更新显示名称  

**结果 / 副作用：** 元数据名称变更；快照内容不变。

**相关需求：** [requirements.md](./requirements.md) §5.1 rename、§5.2  

**细则：** [features/rename.md](./features/rename.md)  

**相关流程：** [merge](./features/merge.md)、[ide-scm](./features/ide-scm.md)。

---

### 提交到工作区（`commit`）

**触发：** `stages commit -m <message>`（可选 `--force`）。

**主路径（摘要）：**

1. 取当前 cycle **最新 active stage** 快照（已含本 cycle 累计）  
2. 检测未 stage 改动：有则默认失败并提示；`--force` 则用该快照覆盖  
3. 将快照应用到工作区；创建 `commit-00N`；归档本 cycle 全部 stage  
4. stage ID 从 `stage-001` 重新计数；**baseline 更新为该 commit 快照**  

**结果 / 副作用：** 工作区对齐快照；**不**执行 `git commit`；git index / history 不变。

**相关需求：** [requirements.md](./requirements.md) §3#3/7/8、§5.1 commit、§5.4  

**细则：** [features/commit.md](./features/commit.md)  

**相关流程：** [log](./features/log.md)、[verify](./features/verify.md)、[snap](./features/snap.md)（新 cycle）、[drop](./features/drop.md)。

---

### 丢弃 stage（`drop`）

**触发：** `stages drop <N>`（确认或 `--yes`；可选 `--force`）；或扩展 Drop。

**主路径（摘要）：**

1. 匹配当前 cycle 中序号 **≥ N** 的未提交 stage（含范围内 merged 元数据）  
2. 用户确认（可跳过）；脏工作区默认拒绝，`--force` 覆盖  
3. 删除匹配元数据；工作区恢复到序号 &lt; N 的最大有效 stage，若无则恢复到 **cycle baseline**  
4. **不**重编号、**不**回收 nextId  

**结果 / 副作用：** 当前 cycle 被截断；工作区回到更早快照；MVP 不强制清理 orphan blob。

**相关需求：** [requirements.md](./requirements.md) §2.4、§3#8/9/12、§5.1 drop  

**细则：** [features/drop.md](./features/drop.md)  

**相关流程：** [commit](./features/commit.md)、[snap](./features/snap.md)、[ide-scm](./features/ide-scm.md)。

---

### Commit 历史（`log`）

**触发：** `stages log`。

**主路径（摘要）：**

1. 列出已创建的 stages commit（新 → 旧）  
2. 查看具体改动使用 `show`（commit id）  

**结果 / 副作用：** 只读；当前 cycle 的 stage 不在此列出。

**相关需求：** [requirements.md](./requirements.md) §5.1 log  

**细则：** [features/log.md](./features/log.md)  

**相关流程：** [commit](./features/commit.md)、[show](./features/show.md)、[ide-scm](./features/ide-scm.md)。

---

### 构建门禁（`verify`）

**触发：** `stages verify`（例如挂在 build 脚本前）。

**主路径（摘要）：**

1. 未 init → 跳过并提示  
2. 无 stage 且无 commit 历史 → 跳过  
3. 当前 cycle 仍有未 commit 的 stage，或工作区有未 stage 改动 → 失败（非 0）  
4. 否则通过  

**结果 / 副作用：** 只读检查；退出码供 CI/脚本使用。

**相关需求：** [requirements.md](./requirements.md) §5.1 verify  

**细则：** [features/verify.md](./features/verify.md)  

**相关流程：** [commit](./features/commit.md)、[snap](./features/snap.md)。

---

### IDE 审查（`ide-scm`）

**触发：** 在 VS Code / Cursor 中打开 Stages SCM 视图。

**主路径（摘要）：**

1. 展示 **Unstaged**（有改动时，相对最新 stage 或 baseline；默认展开）  
2. 展示当前 cycle 的 stage（新 → 旧），再展示 commit 历史（新 → 旧）  
3. 展开文件列表后点击文件 → 左右 diff（语义对齐 CLI `show` / unstaged 规则）  
4. 对未提交 stage：Rename、Drop（含确认）；随 meta / 工作区变化刷新  

**结果 / 副作用：** 审查与有限写操作（rename/drop）；**merge / commit 仍通过 CLI**。

**相关需求：** [requirements.md](./requirements.md) §5.2、§5.5、§7.2 扩展  

**细则：** [features/ide-scm.md](./features/ide-scm.md)  

**相关流程：** [snap](./features/snap.md)、[show](./features/show.md)、[rename](./features/rename.md)、[drop](./features/drop.md)、[log](./features/log.md)、[commit](./features/commit.md)。
