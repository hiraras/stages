import { describe, expect, it } from "vitest";
import { compareManifests } from "../../src/core/store/manifest.js";
import { formatStageId, isCommitRef, resolveCommitId, resolveStageId } from "../../src/core/store/id.js";

describe("manifest compare", () => {
  it("detects added modified deleted files", () => {
    const oldManifest = {
      stageId: "stage-001",
      createdAt: "2026-01-01T00:00:00.000Z",
      files: {
        "src/a.ts": { hash: "a", mode: "100644" },
        "src/b.ts": { hash: "b", mode: "100644" },
      },
    };
    const newManifest = {
      stageId: "stage-002",
      createdAt: "2026-01-02T00:00:00.000Z",
      files: {
        "src/a.ts": { hash: "a2", mode: "100644" },
        "src/c.ts": { hash: "c", mode: "100644" },
      },
    };

    const changes = compareManifests(oldManifest, newManifest);
    expect(changes).toEqual([
      { path: "src/a.ts", type: "modified" },
      { path: "src/b.ts", type: "deleted" },
      { path: "src/c.ts", type: "added" },
    ]);
  });
});

describe("stage id", () => {
  it("resolves short stage ids in current cycle", () => {
    const meta = {
      version: 1 as const,
      baseline: "abc",
      baselineManifestPath: "commits/commit-001.json",
      nextId: 2,
      nextCommitId: 2,
      commits: [],
      stages: [
        {
          id: "stage-001",
          name: "old",
          status: "committed" as const,
          manifestPath: "manifests/stage-001.json",
          createdAt: "2026-01-01",
          prev: null,
          hidden: true,
          commitId: "commit-001",
          stats: { files: 1, additions: 1, deletions: 0 },
        },
        {
          id: "stage-001",
          name: "current",
          status: "pending" as const,
          manifestPath: "manifests/stage-001.json",
          createdAt: "2026-01-02",
          prev: null,
          hidden: false,
          stats: { files: 1, additions: 1, deletions: 0 },
        },
      ],
    };

    expect(resolveStageId(meta, "1")).toBe("stage-001");
    expect(formatStageId(2)).toBe("stage-002");
  });
});

describe("commit id", () => {
  it("resolves commit ids and c-prefix shorthand", () => {
    const meta = {
      version: 1 as const,
      baseline: "abc",
      baselineManifestPath: null,
      nextId: 1,
      nextCommitId: 2,
      stages: [],
      commits: [
        {
          id: "commit-001",
          name: "first",
          createdAt: "2026-01-01",
          manifestPath: "commits/commit-001.json",
          stageIds: ["stage-001"],
          stats: { files: 1, additions: 1, deletions: 0 },
        },
      ],
    };

    expect(resolveCommitId(meta, "commit-001")).toBe("commit-001");
    expect(resolveCommitId(meta, "c1")).toBe("commit-001");
    expect(resolveCommitId(meta, "c001")).toBe("commit-001");
    expect(isCommitRef("c1")).toBe(true);
    expect(isCommitRef("1")).toBe(false);
  });
});
