import type {
  DiffResult,
  FileChangeEntry,
  FileDiff,
  Manifest,
  StageEntry,
  StagesMeta,
} from "../../types/index.js";
import { getBaselineManifest } from "../baseline.js";
import {
  diffFiles,
  getBaselineFileContent,
  getManifestFileContent,
} from "./engine.js";
import { computeStats } from "./stats.js";
import {
  compareManifests,
  readManifest,
} from "../store/manifest.js";
import { getStage, readMeta } from "../store/meta.js";
import { getFileAtCommit, listChangedFilesVsHead } from "../git/head.js";
import { gitExec } from "../git/exec.js";
import { resolveCommitId } from "../store/id.js";

function buildFileDiffs(
  projectRoot: string,
  meta: StagesMeta,
  oldManifest: Manifest | null,
  newManifest: Manifest,
  changes: FileChangeEntry[],
): FileDiff[] {
  const fileDiffs: FileDiff[] = [];

  for (const change of changes) {
    const oldContent =
      oldManifest === null
        ? getBaselineFileContent(projectRoot, meta, change.path)
        : getManifestFileContent(projectRoot, oldManifest, change.path);
    const newContent = getManifestFileContent(projectRoot, newManifest, change.path);
    const diff = diffFiles(projectRoot, oldContent, newContent, change.path);

    if (!diff.trim()) {
      continue;
    }

    fileDiffs.push({
      path: change.path,
      type: change.type,
      diff,
    });
  }

  return fileDiffs;
}

function summarizeDiff(files: FileDiff[]): DiffResult["stats"] {
  const stats = files.map((file) => ({
    files: 1,
    ...computeStats(file.diff),
  }));

  return {
    files: files.length,
    additions: stats.reduce((sum, item) => sum + item.additions, 0),
    deletions: stats.reduce((sum, item) => sum + item.deletions, 0),
  };
}

function getOldManifestForStage(
  projectRoot: string,
  stage: StageEntry,
): Manifest | null {
  if (stage.mergedFrom && stage.mergedFrom.length > 0) {
    const lastMergedId = stage.mergedFrom[stage.mergedFrom.length - 1];
    return readManifest(projectRoot, lastMergedId);
  }

  if (stage.prev) {
    return readManifest(projectRoot, stage.prev);
  }

  return null;
}

export function resolveIncremental(
  projectRoot: string,
  stageId: string,
): DiffResult {
  const meta = readMeta(projectRoot);
  const stage = getStage(projectRoot, stageId);
  return resolveIncrementalWithOldManifest(
    projectRoot,
    stageId,
    getOldManifestForStage(projectRoot, stage),
    meta,
  );
}

export function resolveIncrementalForPrev(
  projectRoot: string,
  stageId: string,
  prev: string | null,
): DiffResult {
  const meta = readMeta(projectRoot);
  const oldManifest = prev ? readManifest(projectRoot, prev) : null;
  return resolveIncrementalWithOldManifest(projectRoot, stageId, oldManifest, meta);
}

function resolveIncrementalWithOldManifest(
  projectRoot: string,
  stageId: string,
  oldManifest: Manifest | null,
  meta: StagesMeta,
): DiffResult {
  const newManifest = readManifest(projectRoot, stageId);
  const changes =
    oldManifest === null
      ? compareAgainstBaseline(projectRoot, meta, newManifest)
      : compareManifests(oldManifest, newManifest);
  const files = buildFileDiffs(
    projectRoot,
    meta,
    oldManifest,
    newManifest,
    changes,
  );

  return {
    stageId,
    files,
    stats: summarizeDiff(files),
  };
}

export function resolveCumulative(
  projectRoot: string,
  stageId: string,
): DiffResult {
  const meta = readMeta(projectRoot);
  const manifest = readManifest(projectRoot, stageId);
  const changes = compareAgainstBaseline(projectRoot, meta, manifest);
  const files = buildFileDiffs(
    projectRoot,
    meta,
    null,
    manifest,
    changes,
  );

  return {
    stageId,
    files,
    stats: summarizeDiff(files),
  };
}

export function getChangesFromBaseline(
  projectRoot: string,
  meta: StagesMeta,
  manifest: Manifest,
): FileChangeEntry[] {
  return compareAgainstBaseline(projectRoot, meta, manifest);
}

function compareAgainstBaseline(
  projectRoot: string,
  meta: StagesMeta,
  manifest: Manifest,
): FileChangeEntry[] {
  const baselineManifest = getBaselineManifest(projectRoot, meta);
  if (baselineManifest) {
    return compareManifests(baselineManifest, manifest);
  }

  const changes: FileChangeEntry[] = [];
  const baselineFiles = listTrackedFilesAtCommit(projectRoot, meta.baseline);
  const baselineSet = new Set(baselineFiles);
  const changedPaths = listChangedFilesVsHead(projectRoot);

  for (const filePath of changedPaths) {
    if (!manifest.files[filePath]) {
      if (baselineSet.has(filePath)) {
        changes.push({ path: filePath, type: "deleted" });
      }
      continue;
    }

    if (!baselineSet.has(filePath)) {
      changes.push({ path: filePath, type: "added" });
      continue;
    }

    changes.push({ path: filePath, type: "modified" });
  }

  changes.sort((a, b) => a.path.localeCompare(b.path));
  return changes;
}

function listTrackedFilesAtCommit(
  projectRoot: string,
  commit: string,
): string[] {
  const output = gitExec(projectRoot, ["ls-tree", "-r", "--name-only", commit], {
    allowFailure: true,
  });

  if (!output) {
    return [];
  }

  return output.split("\n").filter(Boolean);
}

export function resolveCommit(
  projectRoot: string,
  commitId: string,
): DiffResult {
  const meta = readMeta(projectRoot);
  const resolvedId = resolveCommitId(meta, commitId);
  const commitIndex = meta.commits.findIndex((item) => item.id === resolvedId);
  const commit = meta.commits[commitIndex]!;
  const newManifest = readManifest(projectRoot, commit.manifestPath);

  const oldManifest =
    commitIndex > 0
      ? readManifest(projectRoot, meta.commits[commitIndex - 1]!.manifestPath)
      : null;

  const changes =
    oldManifest === null
      ? compareAgainstGitHead(projectRoot, meta, newManifest)
      : compareManifests(oldManifest, newManifest);

  const files = buildCommitFileDiffs(
    projectRoot,
    meta,
    oldManifest,
    newManifest,
    changes,
  );

  return {
    stageId: resolvedId,
    files,
    stats: summarizeDiff(files),
  };
}

function buildCommitFileDiffs(
  projectRoot: string,
  meta: StagesMeta,
  oldManifest: Manifest | null,
  newManifest: Manifest,
  changes: FileChangeEntry[],
): FileDiff[] {
  const fileDiffs: FileDiff[] = [];

  for (const change of changes) {
    const oldContent =
      oldManifest === null
        ? getFileAtCommit(projectRoot, meta.baseline, change.path)
        : getManifestFileContent(projectRoot, oldManifest, change.path);
    const newContent = getManifestFileContent(projectRoot, newManifest, change.path);
    const diff = diffFiles(projectRoot, oldContent, newContent, change.path);

    if (!diff.trim()) {
      continue;
    }

    fileDiffs.push({
      path: change.path,
      type: change.type,
      diff,
    });
  }

  return fileDiffs;
}

function compareAgainstGitHead(
  projectRoot: string,
  meta: StagesMeta,
  manifest: Manifest,
): FileChangeEntry[] {
  const changes: FileChangeEntry[] = [];
  const baselineFiles = listTrackedFilesAtCommit(projectRoot, meta.baseline);
  const baselineSet = new Set(baselineFiles);
  const manifestPaths = new Set(Object.keys(manifest.files));

  for (const filePath of manifestPaths) {
    if (!baselineSet.has(filePath)) {
      changes.push({ path: filePath, type: "added" });
      continue;
    }

    const baselineContent = getFileAtCommit(projectRoot, meta.baseline, filePath);
    const manifestContent = getManifestFileContent(projectRoot, manifest, filePath);
    if (!buffersEqual(baselineContent, manifestContent)) {
      changes.push({ path: filePath, type: "modified" });
    }
  }

  for (const filePath of baselineFiles) {
    if (!manifestPaths.has(filePath)) {
      changes.push({ path: filePath, type: "deleted" });
    }
  }

  changes.sort((a, b) => a.path.localeCompare(b.path));
  return changes;
}

function buffersEqual(
  left: Buffer | null,
  right: Buffer | null,
): boolean {
  if (left === null && right === null) {
    return true;
  }
  if (left === null || right === null) {
    return false;
  }
  return left.equals(right);
}

export function getPrevStageIdForEntry(stage: StageEntry): string | null {
  if (stage.mergedFrom && stage.mergedFrom.length > 0) {
    return stage.mergedFrom[stage.mergedFrom.length - 1];
  }
  return stage.prev;
}
