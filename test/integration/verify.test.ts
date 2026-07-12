import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createStagesAPI } from "../../src/index.js";
import {
  createSimpleProject,
  initTestRepo,
  commitAll,
} from "../helpers/git.js";

const api = createStagesAPI();

describe("integration: verify", () => {
  it("skips when not initialized", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");

    const result = await api.verify(root);
    expect(result).toEqual({ status: "skipped", reason: "not_initialized" });
  });

  it("skips when there are no stages", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    const result = await api.verify(root);
    expect(result).toEqual({ status: "skipped", reason: "no_stages" });
  });

  it("fails when stages are not committed", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 1; }\n",
    );
    await api.snap(root);

    const result = await api.verify(root);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.reason).toBe("uncommitted_stages");
      expect(result.uncommittedStages?.length).toBeGreaterThan(0);
    }
  });

  it("fails when merged stages are not committed", async () => {
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
    await api.merge(root, ["1", "2"], "auth module");

    const result = await api.verify(root);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.reason).toBe("uncommitted_stages");
      expect(
        result.uncommittedStages?.some((stage) => stage.status === "merged"),
      ).toBe(true);
    }
  });

  it("passes when all stages are committed and workspace is clean", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 1; }\n",
    );
    const stage = await api.snap(root);
    await api.commit(root, { message: "initial", force: true });

    const result = await api.verify(root);
    expect(result).toEqual({ status: "ok" });
  });

  it("fails when workspace has unstaged changes after commit", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 1; }\n",
    );
    const stage = await api.snap(root);
    await api.commit(root, { message: "initial", force: true });

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 99; }\n",
    );

    const result = await api.verify(root);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.reason).toBe("dirty_worktree");
      expect(result.dirtyFiles?.length).toBeGreaterThan(0);
    }
  });
});
