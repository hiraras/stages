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

  it("hide committed stage and list --all shows it", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 9; }\n",
    );
    await api.snap(root, { message: "to commit" });
    await api.commit(root, { message: "cycle one", force: true });
    await api.hide(root, "stage-001");

    const active = await api.list(root);
    expect(active).toHaveLength(0);

    const all = await api.list(root, { all: true });
    expect(all.some((stage) => stage.id === "stage-001" && stage.hidden)).toBe(true);
  });

  it("rejects merge on committed stage", async () => {
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

    await expect(
      api.merge(root, ["stage-001", "stage-002"], "should fail"),
    ).rejects.toMatchObject({ code: "MERGE_INVALID_STATUS" });
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
