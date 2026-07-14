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

describe("integration: init", () => {
  it("creates init commit when workspace matches HEAD", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");

    const result = await api.init(root);
    expect(result.alreadyInitialized).toBe(false);
    expect(result.initialCommit?.id).toBe("commit-001");
    expect(result.initialCommit?.name).toBe("init");

    const list = await api.list(root);
    expect(list).toHaveLength(0);

    const log = await api.log(root);
    expect(log).toHaveLength(1);
    expect(log[0]?.id).toBe("commit-001");
  });

  it("snapshots dirty workspace as init commit without creating a stage", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 1; }\n",
    );

    const result = await api.init(root, { message: "bootstrap" });
    expect(result.initialCommit?.id).toBe("commit-001");
    expect(result.initialCommit?.name).toBe("bootstrap");
    expect(result.initialCommit?.stats.files).toBeGreaterThanOrEqual(1);

    const list = await api.list(root);
    expect(list).toHaveLength(0);

    const initDiff = api.show(root, "commit-001");
    expect(initDiff.files.some((file) => file.path === "src/math.ts")).toBe(
      true,
    );

    fs.writeFileSync(
      path.join(root, "src/config.ts"),
      'export const APP_NAME = "after-init";\n',
    );
    await api.snap(root, { message: "feature" });
    await api.commit(root, { message: "feature commit" });

    const log = await api.log(root);
    expect(log.map((c) => c.id)).toEqual(["commit-002", "commit-001"]);

    const featureDiff = api.show(root, "commit-002");
    expect(featureDiff.files.some((file) => file.path === "src/config.ts")).toBe(
      true,
    );
    // Post-init work should not re-include HEAD→init math.ts change as sole story;
    // math.ts was already in init commit, so adjacent commit-002 should focus on later edits.
    expect(
      featureDiff.files.some((file) => file.path === "src/math.ts"),
    ).toBe(false);
  });

  it("skips when already initialized", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    const again = await api.init(root, { message: "ignored" });
    expect(again.alreadyInitialized).toBe(true);
    expect(again.initialCommit).toBeUndefined();

    const log = await api.log(root);
    expect(log).toHaveLength(1);
  });
});
