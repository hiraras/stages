import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createStagesAPI } from "../../src/index.js";
import {
  createSimpleProject,
  gitStatusPorcelain,
  initTestRepo,
  commitAll,
} from "../helpers/git.js";

const api = createStagesAPI();

describe("integration: snap merge commit", () => {
  it("creates stages without changing git status", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");

    const statusBefore = gitStatusPorcelain(root);
    await api.init(root);

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 1; }\n",
    );

    const statusAfterFirstModify = gitStatusPorcelain(root);
    const stage1 = await api.snap(root, { message: "login" });
    expect(stage1.id).toBe("stage-001");
    expect(gitStatusPorcelain(root)).toBe(statusAfterFirstModify);

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 2; }\n",
    );

    const statusAfterSecondModify = gitStatusPorcelain(root);
    const stage2 = await api.snap(root, { message: "register" });
    expect(stage2.id).toBe("stage-002");

    const statusAfter = gitStatusPorcelain(root);
    expect(statusAfter).toBe(statusAfterSecondModify);

    const diff1 = api.show(root, "1");
    expect(diff1.stats.files).toBeGreaterThanOrEqual(0);

    const diff2 = api.show(root, "2");
    expect(diff2.files.some((file) => file.path === "src/math.ts")).toBe(true);
    expect(diff2.files[0]?.diff.length).toBeGreaterThan(0);

    fs.writeFileSync(
      path.join(root, "src/new-file.ts"),
      "export const created = true;\n",
    );
    const stage3 = await api.snap(root, { message: "add file" });
    const diff3 = api.show(root, stage3.id);
    expect(diff3.files.some((file) => file.path === "src/new-file.ts")).toBe(true);
    expect(diff3.files.find((file) => file.path === "src/new-file.ts")?.diff.length).toBeGreaterThan(0);
    expect(diff3.stats.files).toBeGreaterThan(0);

    const merged = await api.merge(root, ["1", "2"], "auth module");
    expect(merged.id).toBe("stage-001");
    expect(merged.name).toBe("auth module");
    expect(merged.mergedFrom).toEqual(["stage-001", "stage-002"]);

    const mergedDiff = api.show(root, merged.id);
    expect(mergedDiff.stats.files).toBeGreaterThan(0);
    expect(mergedDiff.files.length).toBeGreaterThan(0);

    const list = await api.list(root);
    expect(list).toHaveLength(2);
    expect(list.find((item) => item.id === "stage-001")?.name).toBe("auth module");
    expect(list.find((item) => item.id === "stage-002")).toBeUndefined();
    expect(list.find((item) => item.id === "stage-003")?.prev).toBe("stage-001");

    await api.commit(root, { message: "auth module", force: true });
    const allStages = await api.list(root, { all: true });
    expect(allStages.every((item) => item.status === "committed")).toBe(true);

    const commits = await api.log(root);
    expect(commits).toHaveLength(2);
    expect(commits[0]?.name).toBe("auth module");
    expect(commits[1]?.name).toBe("init");

    const commitDiff = api.show(root, "commit-002");
    expect(commitDiff.stats.files).toBeGreaterThan(0);
    expect(commitDiff.files.some((file) => file.path === "src/math.ts")).toBe(true);

    const commitDiffShort = api.show(root, "c2");
    expect(commitDiffShort.stats.files).toBe(commitDiff.stats.files);

    const commitFile = await api.readCommitFile(root, "commit-002", "src/math.ts");
    expect(commitFile).not.toBeNull();
    expect(commitFile!.toString("utf8")).toContain("return a + b + 2");

    expect(await api.getPrevCommitId(root, "commit-001")).toBeNull();
    expect(await api.getPrevCommitId(root, "commit-002")).toBe("commit-001");

    const activeList = await api.list(root);
    expect(activeList).toHaveLength(0);

    expect(gitStatusPorcelain(root)).toContain("src/math.ts");
  });

  it("exposes commit file reads and previous commit links", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 1; }\n",
    );
    await api.snap(root, { message: "first cycle" });
    await api.commit(root, { message: "cycle one", force: true });

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 9; }\n",
    );
    await api.snap(root, { message: "second cycle" });
    await api.commit(root, { message: "cycle two", force: true });

    expect(await api.getPrevCommitId(root, "commit-001")).toBeNull();
    expect(await api.getPrevCommitId(root, "commit-002")).toBe("commit-001");
    expect(await api.getPrevCommitId(root, "commit-003")).toBe("commit-002");

    const secondCycleFile = await api.readCommitFile(
      root,
      "commit-003",
      "src/math.ts",
    );
    expect(secondCycleFile?.toString("utf8")).toContain("return a + b + 9");
  });

  it("rejects snap when workspace matches latest stage", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 1; }\n",
    );

    await api.snap(root, { message: "first" });

    await expect(api.snap(root, { message: "duplicate" })).rejects.toMatchObject({
      code: "SNAP_NO_CHANGES",
    });
  });

  it("honors .stagesignore when snapping", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    fs.writeFileSync(path.join(root, ".stagesignore"), "tmp-ignored/**\n");
    fs.mkdirSync(path.join(root, "tmp-ignored"), { recursive: true });
    fs.writeFileSync(path.join(root, "tmp-ignored/secret.txt"), "nope\n");
    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 9; }\n",
    );

    const stage = await api.snap(root, { message: "with ignore" });
    const diff = api.show(root, stage.id);
    expect(diff.files.some((file) => file.path.includes("tmp-ignored"))).toBe(
      false,
    );
    expect(diff.files.some((file) => file.path === "src/math.ts")).toBe(true);
  });

  it("rejects non-contiguous merge", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 1; }\n",
    );
    await api.snap(root);

    fs.writeFileSync(
      path.join(root, "src/config.ts"),
      'export const APP_NAME = "stages-demo-2";\n',
    );
    await api.snap(root);

    fs.writeFileSync(
      path.join(root, "src/index.ts"),
      'export function greet(name: string) { return `Hi, ${name}!`; }\n',
    );
    await api.snap(root);

    await expect(
      api.merge(root, ["1", "3"], "invalid"),
    ).rejects.toThrow(/non-contiguous/i);
  });
});
