import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createStagesAPI } from "../../src/index.js";
import {
  commitAll,
  createSimpleProject,
  initTestRepo,
} from "../helpers/git.js";

const api = createStagesAPI();

describe("performance benchmarks", () => {
  it("snap 100 files completes within 2s", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    const filesDir = path.join(root, "src", "bulk");
    fs.mkdirSync(filesDir, { recursive: true });
    for (let index = 0; index < 100; index += 1) {
      fs.writeFileSync(
        path.join(filesDir, `file-${String(index).padStart(3, "0")}.ts`),
        `export const value${index} = ${index};\n`,
      );
    }

    const start = performance.now();
    await api.snap(root, { message: "bulk" });
    const elapsed = performance.now() - start;
    const budgetMs = process.platform === "win32" ? 8000 : 2000;

    expect(elapsed).toBeLessThan(budgetMs);
  });

  it("list 50 stages completes within 100ms", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    for (let index = 0; index < 50; index += 1) {
      fs.writeFileSync(
        path.join(root, "src/math.ts"),
        `export function add(a: number, b: number) { return a + b + ${index}; }\n`,
      );
      await api.snap(root, { message: `stage-${index}` });
    }

    const start = performance.now();
    const list = await api.list(root);
    const elapsed = performance.now() - start;

    expect(list.length).toBe(50);
    expect(elapsed).toBeLessThan(100);
  });

  it("show diff for 10 changed files completes within 1s", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    const filesDir = path.join(root, "src", "perf");
    fs.mkdirSync(filesDir, { recursive: true });
    for (let index = 0; index < 10; index += 1) {
      fs.writeFileSync(
        path.join(filesDir, `mod-${index}.ts`),
        `export const n${index} = ${index};\n`,
      );
    }
    await api.snap(root, { message: "perf show" });

    const start = performance.now();
    const diff = api.show(root, "1");
    const elapsed = performance.now() - start;

    expect(diff.files.length).toBe(10);
    expect(elapsed).toBeLessThan(1000);
  });
});
