import type { DirtyFile, StageEntry, VerifyResult } from "../../types/index.js";
import { getBaselineManifest } from "../baseline.js";
import { detectDirtyFiles } from "../git/dirty.js";
import { readManifest } from "../store/manifest.js";
import {
  getCurrentCycleStages,
  getLatestStage,
  isInitialized,
  readMeta,
} from "../store/meta.js";

async function detectDirtyAgainstReference(
  projectRoot: string,
  meta: ReturnType<typeof readMeta>,
): Promise<DirtyFile[]> {
  const baselineManifest = getBaselineManifest(projectRoot, meta);
  if (baselineManifest) {
    return detectDirtyFiles(projectRoot, baselineManifest);
  }

  const latest = getLatestStage(meta);
  if (latest) {
    return detectDirtyFiles(projectRoot, readManifest(projectRoot, latest.id));
  }

  return [];
}

export async function verify(projectRoot: string): Promise<VerifyResult> {
  if (!isInitialized(projectRoot)) {
    return { status: "skipped", reason: "not_initialized" };
  }

  const meta = readMeta(projectRoot);
  const cycleStages = getCurrentCycleStages(meta);

  if (cycleStages.length === 0 && meta.commits.length === 0) {
    return { status: "skipped", reason: "no_stages" };
  }

  const uncommittedStages = cycleStages.filter(
    (stage) => stage.status !== "committed",
  );
  if (uncommittedStages.length > 0) {
    return {
      status: "failed",
      reason: "uncommitted_stages",
      uncommittedStages,
    };
  }

  const dirtyFiles = await detectDirtyAgainstReference(projectRoot, meta);
  if (dirtyFiles.length > 0) {
    return {
      status: "failed",
      reason: "dirty_worktree",
      dirtyFiles,
    };
  }

  return { status: "ok" };
}

export function formatUncommittedStages(stages: StageEntry[]): string[] {
  return stages.map(
    (stage) => `${stage.id} "${stage.name}" (${stage.status})`,
  );
}

export function formatDirtyFiles(files: DirtyFile[]): string[] {
  return files.map((file) => {
    const label = file.reason === "added" ? "A" : file.reason === "deleted" ? "D" : "M";
    return `${label}  ${file.path}`;
  });
}
