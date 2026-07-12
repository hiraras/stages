# P0 — 项目初始化

> 预估：0.5 天  
> 前置依赖：无  
> 产出：可运行的空项目骨架 + 测试环境

---

## P0-01 初始化 package.json、tsconfig、tsup 配置

**描述：** 创建主包配置文件，设定构建与发布基础。

**交付物：**
- `package.json`：name、version、bin、exports、dependencies
- `tsconfig.json`：strict mode、ES2022 target
- `tsup.config.ts`：打包 src/index.ts + src/cli/index.ts

**依赖：**
```json
{
  "dependencies": {
    "commander": "^12.x",
    "fast-glob": "^3.x",
    "ignore": "^6.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tsup": "^8.x",
    "vitest": "^2.x",
    "@types/node": "^20.x"
  }
}
```

**验收标准：**
- [ ] `npm run build` 成功输出 dist/
- [ ] `package.json` exports 暴露 core API

---

## P0-02 搭建 src/ 目录结构

**描述：** 按 system-design §3 创建源码目录骨架。

**交付物：**
```
src/
├── core/
│   ├── index.ts
│   ├── store/
│   ├── diff/
│   ├── stage/
│   ├── git/
│   └── scanner/
├── cli/
│   ├── index.ts
│   └── commands/
└── types/
    └── index.ts
```

**验收标准：**
- [ ] 目录结构与设计文档一致
- [ ] `src/core/index.ts` 导出空 StagesAPI 接口
- [ ] `src/types/index.ts` 定义基础类型占位

---

## P0-03 配置 Vitest 测试环境

**描述：** 配置测试框架与脚本。

**交付物：**
- `vitest.config.ts`
- `package.json` scripts：`test`、`test:watch`

**验收标准：**
- [ ] `npm test` 可运行（至少 1 个 placeholder 测试通过）
- [ ] 支持 TypeScript 直接运行

---

## P0-04 创建 test/fixtures 测试仓库

**描述：** 准备集成测试用的 git 仓库样本。

**交付物：**
```
test/
├── fixtures/
│   ├── empty-repo/         # git init only
│   └── simple-project/     # 含 src/ 下几个 .ts 文件 + .gitignore
└── helpers/
    ├── copy-fixture.ts     # 复制 fixture 到临时目录
    └── run-git.ts          # git 命令辅助
```

**验收标准：**
- [ ] empty-repo 是有效的 git 仓库
- [ ] simple-project 含至少 3 个源文件
- [ ] helper 可在测试中创建隔离的临时项目目录

---

## P0-05 编写 README 骨架

**描述：** 创建项目 README 基本结构，后续阶段逐步完善。

**交付物：**
- `README.md`：项目简介、安装、基本用法占位

**验收标准：**
- [ ] README 包含项目名称、一句话定位、安装命令占位
