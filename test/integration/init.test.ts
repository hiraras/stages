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
  it("creates no stage when workspace matches HEAD", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");

    const result = await api.init(root);
    expect(result.alreadyInitialized).toBe(false);
    expect(result.initialStage).toBeUndefined();

    const list = await api.list(root);
    expect(list).toHaveLength(0);
  });

  it("auto-creates first stage with only changes vs HEAD", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 1; }\n",
    );

    const result = await api.init(root);
    expect(result.initialStage?.id).toBe("stage-001");
    expect(result.initialStage?.stats.files).toBe(1);

    const diff = api.show(root, "1");
    expect(diff.files).toHaveLength(1);
    expect(diff.files[0]?.path).toBe("src/math.ts");
  });
});
