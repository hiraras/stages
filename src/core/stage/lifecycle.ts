import type { StageEntry, StatusSummary } from "../../types/index.js";
import { StagesError } from "../errors.js";
import { getBaselineFileContent, getManifestFileContent } from "../diff/engine.js";
import { getPrevStageIdForEntry } from "../diff/resolver.js";
import { resolveCommitId, resolveStageId } from "../store/id.js";
import { readManifest } from "../store/manifest.js";
import { findStages, getCommit, getStage, readMeta, updateStage } from "../store/meta.js";

export async function rename(
  projectRoot: string,
  stageId: string,
  newName: string,
): Promise<void> {
  const meta = readMeta(projectRoot);
  const resolvedId = resolveStageId(meta, stageId);
  const stage = getStage(projectRoot, resolvedId);

  if (stage.status !== "pending" && stage.status !== "ready") {
    throw new StagesError(
      "INVALID_RENAME",
      `Cannot rename stage ${stage.id} with status ${stage.status}.`,
    );
  }

  if (!newName.trim()) {
    throw new StagesError("INVALID_RENAME", "Stage name cannot be empty.");
  }

  updateStage(projectRoot, resolvedId, { name: newName.trim() });
}

export async function list(
  projectRoot: string,
  opts?: { all?: boolean },
): Promise<StageEntry[]> {
  return findStages(projectRoot, opts);
}

export async function status(projectRoot: string): Promise<StatusSummary> {
  const meta = readMeta(projectRoot);
  const stages = meta.stages;

  const byStatus = {
    pending: 0,
    merged: 0,
    ready: 0,
    committed: 0,
  } satisfies StatusSummary["byStatus"];

  for (const stage of stages) {
    byStatus[stage.status] += 1;
  }

  const latest = stages
    .filter((stage) => stage.status !== "merged")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  return {
    baseline: meta.baseline,
    total: stages.length,
    byStatus,
    latest,
  };
}

export async function readFile(
  projectRoot: string,
  stageId: string,
  filePath: string,
): Promise<Buffer | null> {
  const meta = readMeta(projectRoot);
  const resolvedId = resolveStageId(meta, stageId);
  const manifest = readManifest(projectRoot, resolvedId);
  return getManifestFileContent(projectRoot, manifest, filePath);
}

export async function readCommitFile(
  projectRoot: string,
  commitId: string,
  filePath: string,
): Promise<Buffer | null> {
  const meta = readMeta(projectRoot);
  const resolvedId = resolveCommitId(meta, commitId);
  const commit = getCommit(projectRoot, resolvedId);
  const manifest = readManifest(projectRoot, commit.manifestPath);
  return getManifestFileContent(projectRoot, manifest, filePath);
}

export async function getPrevStageId(
  projectRoot: string,
  stageId: string,
): Promise<string | null> {
  const meta = readMeta(projectRoot);
  const resolvedId = resolveStageId(meta, stageId);
  const stage = getStage(projectRoot, resolvedId);
  return getPrevStageIdForEntry(stage);
}

export async function getPrevCommitId(
  projectRoot: string,
  commitId: string,
): Promise<string | null> {
  const meta = readMeta(projectRoot);
  const resolvedId = resolveCommitId(meta, commitId);
  const commitIndex = meta.commits.findIndex((item) => item.id === resolvedId);
  if (commitIndex <= 0) {
    return null;
  }
  return meta.commits[commitIndex - 1]!.id;
}

export async function readBaselineFile(
  projectRoot: string,
  filePath: string,
): Promise<Buffer | null> {
  const meta = readMeta(projectRoot);
  return getBaselineFileContent(projectRoot, meta, filePath);
}
