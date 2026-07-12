import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createStagesAPI, StagesError } from "../../src/index.js";
import {
  commitAll,
  createSimpleProject,
  initTestRepo,
} from "../helpers/git.js";

const api = createStagesAPI();

async function snapStages(root: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      `export function add(a: number, b: number) { return a + b + ${index + 1}; }\n`,
    );
    await api.snap(root, { message: `stage ${index + 1}` });
  }
}

describe("drop", () => {
  it("drops only the latest stage when id is the tail", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);
    await snapStages(root, 5);

    const result = await api.drop(root, "5", { force: true });
    expect(result.droppedIds).toEqual(["stage-005"]);
    expect(result.restoreTarget).toMatchObject({
      kind: "stage",
      stageId: "stage-004",
    });

    const list = await api.list(root);
    expect(list.map((stage) => stage.id).sort()).toEqual([
      "stage-001",
      "stage-002",
      "stage-003",
      "stage-004",
    ]);
    expect(fs.readFileSync(path.join(root, "src/math.ts"), "utf8")).toContain("+ 4");
  });

  it("drops from the given id through the tail and restores worktree", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);
    await snapStages(root, 5);

    const result = await api.drop(root, "3", { force: true });
    expect(result.droppedIds).toEqual([
      "stage-003",
      "stage-004",
      "stage-005",
    ]);
    expect(result.restoreTarget).toMatchObject({
      kind: "stage",
      stageId: "stage-002",
    });

    const list = await api.list(root);
    expect(list.map((stage) => stage.id).sort()).toEqual([
      "stage-001",
      "stage-002",
    ]);
    expect(fs.readFileSync(path.join(root, "src/math.ts"), "utf8")).toContain("+ 2");
  });

  it("drops high-numbered stages after an id gap", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);
    await snapStages(root, 5);
    await api.drop(root, "5", { force: true });

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 99; }\n",
    );
    await api.snap(root, { message: "stage six" });

    const result = await api.drop(root, "4", { force: true });
    expect(result.droppedIds).toEqual(["stage-004", "stage-006"]);
    expect(result.restoreTarget).toMatchObject({
      kind: "stage",
      stageId: "stage-003",
    });

    const list = await api.list(root);
    expect(list.map((stage) => stage.id).sort()).toEqual([
      "stage-001",
      "stage-002",
      "stage-003",
    ]);
  });

  it("allows dropping all stages in the current cycle", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 1; }\n",
    );
    await api.snap(root, { message: "only stage" });

    const result = await api.drop(root, "1", { force: true });
    expect(result.droppedIds).toEqual(["stage-001"]);
    expect(result.restoreTarget).toEqual({ kind: "baseline" });
    expect(await api.list(root)).toHaveLength(0);
    expect(fs.readFileSync(path.join(root, "src/math.ts"), "utf8")).toContain(
      "return a + b;",
    );
  });

  it("rejects drop entry on merged stage", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);
    await snapStages(root, 3);
    await api.merge(root, ["1", "2"], "merged");

    await expect(api.drop(root, "2")).rejects.toMatchObject({
      code: "DROP_INVALID_STATUS",
    });
  });

  it("requires force when worktree is dirty", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);
    await snapStages(root, 2);

    fs.writeFileSync(
      path.join(root, "src/config.ts"),
      'export const APP_NAME = "dirty";\n',
    );

    await expect(api.drop(root, "2")).rejects.toMatchObject({
      code: "DIRTY_WORKTREE",
    });

    const result = await api.drop(root, "2", { force: true });
    expect(result.droppedIds).toEqual(["stage-002"]);
  });

  it("planDrop includes merged stages in the delete set when dropping from 1", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);
    await snapStages(root, 3);
    await api.merge(root, ["1", "2"], "merged");

    fs.writeFileSync(
      path.join(root, "src/config.ts"),
      'export const APP_NAME = "stage three";\n',
    );
    await api.snap(root, { message: "stage three" });

    const plan = api.planDrop(root, "1");
    expect(plan.droppedStages.map((stage) => stage.id)).toEqual([
      "stage-001",
      "stage-002",
      "stage-003",
      "stage-004",
    ]);
  });
});

describe("drop entry validation", () => {
  it("throws STAGE_NOT_FOUND for missing stage", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    await expect(api.drop(root, "9")).rejects.toBeInstanceOf(StagesError);
  });
});
