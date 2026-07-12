import type { CommitEntry } from "../../types/index.js";
import { getBaselineManifest } from "../baseline.js";
import { applyCumulativeToWorktree } from "../diff/engine.js";
import { resolveCumulative } from "../diff/resolver.js";
import { StagesError } from "../errors.js";
import { detectDirtyFiles } from "../git/dirty.js";
import { getCommitManifestDir } from "../paths.js";
import fs from "node:fs";
import { readManifest, writeManifest } from "../store/manifest.js";
import type { Manifest } from "../../types/index.js";
import { formatCommitId } from "../store/id.js";
import {
  addCommit,
  archiveCurrentCycle,
  getCurrentCycleStages,
  getLatestActiveStage,
  incrementNextCommitId,
  readMeta,
} from "../store/meta.js";

export async function commit(
  projectRoot: string,
  opts: { message: string; force?: boolean },
): Promise<CommitEntry> {
  if (!opts.message.trim()) {
    throw new StagesError(
      "COMMIT_MESSAGE_REQUIRED",
      "Commit requires -m option.",
    );
  }

  const meta = readMeta(projectRoot);
  const cycleStages = getCurrentCycleStages(meta);
  if (cycleStages.length === 0) {
    throw new StagesError(
      "COMMIT_NO_STAGES",
      "No stages to commit in the current cycle.",
    );
  }

  const latest = getLatestActiveStage(meta);
  if (!latest) {
    throw new StagesError(
      "COMMIT_NO_STAGES",
      "No active stage found in the current cycle.",
    );
  }

  const latestManifest = readManifest(projectRoot, latest.id);
  if (!opts?.force) {
    const dirty = await detectDirtyFiles(projectRoot, latestManifest);
    if (dirty.length > 0) {
      throw new StagesError(
        "DIRTY_WORKTREE",
        "Working tree has uncommitted changes.",
      );
    }
  }

  applyCumulativeToWorktree(projectRoot, meta, latestManifest);

  const commitSequence = incrementNextCommitId(projectRoot);
  const commitId = formatCommitId(commitSequence);
  const createdAt = new Date().toISOString();
  const manifestPath = `commits/${commitId}.json`;

  fs.mkdirSync(getCommitManifestDir(projectRoot), { recursive: true });
  const commitManifest: Manifest = {
    stageId: manifestPath,
    createdAt,
    files: { ...latestManifest.files },
  };
  writeManifest(projectRoot, commitManifest);

  const diffResult = resolveCumulative(projectRoot, latest.id);
  const stageIds = cycleStages.map((stage) => stage.id);

  const entry: CommitEntry = {
    id: commitId,
    name: opts.message.trim(),
    createdAt,
    manifestPath,
    stageIds,
    stats: diffResult.stats,
  };

  addCommit(projectRoot, entry);
  archiveCurrentCycle(projectRoot, commitId, manifestPath);

  return entry;
}
