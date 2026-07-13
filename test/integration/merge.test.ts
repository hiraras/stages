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

async function createThreeDistinctStages(root: string) {
  await api.init(root);

  fs.writeFileSync(
    path.join(root, "src/math.ts"),
    "export function add(a: number, b: number) { return a + b + 1; }\n",
  );
  await api.snap(root, { message: "s1" });

  fs.writeFileSync(
    path.join(root, "src/config.ts"),
    'export const APP_NAME = "stages-demo-v2";\n',
  );
  await api.snap(root, { message: "s2" });

  fs.writeFileSync(
    path.join(root, "src/index.ts"),
    'export function greet(name: string) { return `Hi, ${name}!`; }\n',
  );
  await api.snap(root, { message: "s3" });
}

describe("integration: merge diff scope", () => {
  it("merge 1 2 3 only includes those three stages", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await createThreeDistinctStages(root);

    const merged = await api.merge(root, ["1", "2", "3"], "all three");
    const diff = api.show(root, merged.id);
    const paths = diff.files.map((file) => file.path).sort();

    expect(paths).toEqual(
      ["src/config.ts", "src/index.ts", "src/math.ts"].sort(),
    );
  });

  it("merge 2 3 excludes earlier stage 1 changes", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await createThreeDistinctStages(root);

    const merged = await api.merge(root, ["2", "3"], "two and three");
    const diff = api.show(root, merged.id);
    const paths = diff.files.map((file) => file.path).sort();

    expect(paths).toEqual(["src/config.ts", "src/index.ts"].sort());
    expect(paths).not.toContain("src/math.ts");
  });

  it("merge 1 2 3 after prior commit only includes current cycle changes", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 99; }\n",
    );
    await api.snap(root, { message: "cycle1" });
    await api.commit(root, { message: "cycle1", force: true });

    fs.writeFileSync(
      path.join(root, "src/config.ts"),
      'export const APP_NAME = "cycle2";\n',
    );
    await api.snap(root, { message: "c2s1" });

    fs.writeFileSync(
      path.join(root, "src/index.ts"),
      'export function greet(name: string) { return `Cycle2 ${name}`; }\n',
    );
    await api.snap(root, { message: "c2s2" });

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 100; }\n",
    );
    await api.snap(root, { message: "c2s3" });

    const merged = await api.merge(root, ["1", "2", "3"], "cycle2 all");
    const diff = api.show(root, merged.id);
    const paths = diff.files.map((file) => file.path).sort();

    expect(paths).toEqual(
      ["src/config.ts", "src/index.ts", "src/math.ts"].sort(),
    );
    const mathDiff = diff.files.find((file) => file.path === "src/math.ts")?.diff ?? "";
    expect(mathDiff).toContain("+ 100");
    expect(mathDiff).toContain("b + 99");
  });
});
