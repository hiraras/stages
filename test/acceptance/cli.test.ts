import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createStagesAPI } from "../../src/index.js";
import {
  commitAll,
  createSimpleProject,
  gitStatusPorcelain,
  initTestRepo,
} from "../helpers/git.js";

const api = createStagesAPI();

describe("acceptance: CLI requirements §12.1", () => {
  it("rename updates pending stage name", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 1; }\n",
    );
    await api.snap(root, { message: "before rename" });
    await api.rename(root, "1", "after rename");

    const list = await api.list(root);
    expect(list[0]?.name).toBe("after rename");
  });

  it("rejects merge on stages from a previous cycle", async () => {
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
      'export const APP_NAME = "changed";\n',
    );
    await api.snap(root);

    await api.commit(root, { message: "done", force: true });

    // Archived stages are not in the current cycle (STAGE_NOT_FOUND), not mergeable.
    await expect(
      api.merge(root, ["stage-001", "stage-002"], "should fail"),
    ).rejects.toMatchObject({ code: "STAGE_NOT_FOUND" });
  });

  it("dirty worktree commit requires force", async () => {
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
      'export const APP_NAME = "dirty";\n',
    );

    await expect(
      api.commit(root, { message: "blocked" }),
    ).rejects.toMatchObject({ code: "DIRTY_WORKTREE" });

    const entry = await api.commit(root, { message: "forced", force: true });
    expect(entry.id).toBe("commit-001");
    expect(gitStatusPorcelain(root)).toContain("src/math.ts");
  });
});
