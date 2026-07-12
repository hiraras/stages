import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readBlob } from "../../src/core/store/blob.js";
import { assertSafeRelativePath } from "../../src/core/paths.js";
import { StagesError } from "../../src/core/errors.js";
import { readMeta } from "../../src/core/store/meta.js";
import {
  commitAll,
  createSimpleProject,
  initTestRepo,
} from "../helpers/git.js";
import { createStagesAPI } from "../../src/index.js";

const api = createStagesAPI();

describe("security", () => {
  it("rejects path traversal in relative paths", () => {
    expect(() => assertSafeRelativePath("../etc/passwd")).toThrow(/Unsafe path/);
    expect(() => assertSafeRelativePath("/absolute")).toThrow(/Unsafe path/);
  });

  it("reports corrupt blob hash mismatch", () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");

    const fakeHash = `aa${"0".repeat(62)}`;
    const blobPath = path.join(root, ".stages", "blobs", "aa", "0".repeat(62));
    fs.mkdirSync(path.dirname(blobPath), { recursive: true });
    fs.writeFileSync(blobPath, "tampered");

    expect(() => readBlob(root, fakeHash)).toThrow(StagesError);
    try {
      readBlob(root, fakeHash);
    } catch (error) {
      expect((error as StagesError).code).toBe("BLOB_CORRUPT");
    }
  });

  it("writes meta.json atomically via temp file", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    fs.writeFileSync(
      path.join(root, "src/math.ts"),
      "export function add(a: number, b: number) { return a + b + 1; }\n",
    );
    await api.snap(root, { message: "atomic" });

    const metaPath = path.join(root, ".stages", "meta.json");
    expect(fs.existsSync(metaPath)).toBe(true);
    expect(fs.existsSync(`${metaPath}.tmp`)).toBe(false);

    const meta = readMeta(root);
    expect(meta.stages).toHaveLength(1);
  });

  it("handles special characters in file paths during snap", async () => {
    const root = createSimpleProject();
    initTestRepo(root);
    commitAll(root, "init");
    await api.init(root);

    const specialDir = path.join(root, "src", "special dir");
    fs.mkdirSync(specialDir, { recursive: true });
    fs.writeFileSync(
      path.join(specialDir, "file [1].ts"),
      "export const ok = true;\n",
    );

    const stage = await api.snap(root, { message: "special chars" });
    expect(stage.stats.files).toBeGreaterThan(0);
    const diff = api.show(root, stage.id);
    expect(diff.files.length).toBeGreaterThan(0);
  });
});
