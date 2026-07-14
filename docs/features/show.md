# 查看 diff 流程细则

> 状态：已确认  
> 总纲：[business-flow.md](../business-flow.md) · `show`  
> 关联：[requirements.md](../requirements.md) §3.1、§5.1、§5.5 · [system-design.md](../system-design.md)

## 1. 范围与动机

只读展示某个 stage 或 stages commit 的文件差异，供终端或编辑器审查。

## 2. 对外形式

```bash
# Stage（数字简写 = 当前 cycle）
stages show 1
stages show stage-001
stages show 2 --open
stages show 1 --stat

# Commit
stages show commit-001
stages show c1
stages show c001 --stat
```

| 选项 | Stage | Commit |
|------|-------|--------|
| `--stat` | 支持 | 支持 |
| `--open` | 支持（调起编辑器） | MVP **不支持** |

## 3. 语义与规则

### 3.1 作用域与 ID

- **数字简写**（`1`）**仅匹配当前 cycle** 的 stage（requirements §3.1）。
- 历史同名 stage：须完整 ID，并结合 `--all` / 元数据理解；MVP 以当前 cycle 为主路径。
- Commit：`commit-001` / `c1` / `c001` 等形式解析为 commit 节点。

### 3.2 Stage diff

| 情形 | 语义 |
|------|------|
| 普通 stage | 相对上一 active stage 的**增量**；本 cycle 第一个相对 **cycle baseline** |
| 合并后保留的 stage | 相对累计起点（父级/baseline）的**累计** diff（与就地合并最终快照一致） |

### 3.3 Commit diff

| Commit | 语义 |
|--------|------|
| `commit-001` | 相对初始 git HEAD（meta 中记录）→ 该 commit 快照 |
| `commit-00N`（N>1） | 相对 `commit-00(N-1)` → 该 commit 的**相邻增量** |

### 3.4 文件类型

新增 / 修改 / 删除：一侧为空或对应版本内容。

## 4. 与其它流程的关系

- 数据来自 [snap](./snap.md)/[merge](./merge.md)/[commit](./commit.md) 产生的快照。
- 扩展内 diff 对齐本流程：[ide-scm](./ide-scm.md)。

## 5. 模块衔接

| 层级 | 职责 |
|------|------|
| Core | ID 解析、diff 计算、stat |
| CLI | 输出 / 调起 `--open` |
| 扩展 | 虚拟 URI 读快照内容（设计定稿） |

## 6. 数据 / 存储（仅本流程）

只读 snapshot / commit manifest。

## 7. 错误与边界

| 场景 | 行为 |
|------|------|
| 当前 cycle 无该数字 stage | 失败提示 |
| 未知 commit id | 失败提示 |
| commit + `--open` | MVP：拒绝或忽略并提示不支持 |

## 8. 验收要点

- 增量 / 累计 / 相邻 commit 语义正确
- 数字简写不命中历史 cycle 同名 stage
- `--stat` 可用；stage `--open` 可用

## 9. 非目标 / 后续

- commit `--open`；按行采纳 UI。
