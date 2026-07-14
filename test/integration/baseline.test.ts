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

describe("integration: baseline after commit", () => {
  it("readBaselineFile reflects latest stages commit manifest", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    const initMath = fs.readFileSync(path.join(root, "src/math.ts"), "utf8");

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 99; }\n",
    );
    await api.snap(root, { message: "cycle1" });
    await api.commit(root, { message: "cycle1", force: true });

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 100; }\n",
    );
    const stage = await api.snap(root, { message: "cycle2" });

    const baselineMath = await api.readBaselineFile(root, "src/math.ts");
    const commitMath = await api.readCommitFile(root, "commit-002", "src/math.ts");
    const stageMath = await api.readFile(root, stage.id, "src/math.ts");

    expect(baselineMath?.toString("utf8")).toBe(commitMath?.toString("utf8"));
    expect(baselineMath?.toString("utf8")).toContain("+ 99");
    expect(baselineMath?.toString("utf8")).not.toBe(initMath);
    expect(stageMath?.toString("utf8")).toContain("+ 100");

    const diff = api.show(root, stage.id);
    const mathDiff = diff.files.find((file) => file.path === "src/math.ts")?.diff ?? "";
    expect(mathDiff).toContain("+ 99");
    expect(mathDiff).toContain("+ 100");
    expect(mathDiff).not.toContain(initMath.trim());
  });
});
