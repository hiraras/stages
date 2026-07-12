import fs from "node:fs";
import type { CommitEntry, StageEntry, StagesMeta } from "../../types/index.js";
import { StagesError } from "../errors.js";
import { getMetaPath, getStagesDir } from "../paths.js";
import { formatCommitId } from "./id.js";

function normalizeMeta(raw: Partial<StagesMeta> & { baseline: string }): StagesMeta {
  return {
    version: 1,
    baseline: raw.baseline,
    baselineManifestPath: raw.baselineManifestPath ?? null,
    nextId: raw.nextId ?? 1,
    nextCommitId: raw.nextCommitId ?? 1,
    stages: raw.stages ?? [],
    commits: raw.commits ?? [],
  };
}

export function isInitialized(projectRoot: string): boolean {
  return fs.existsSync(getMetaPath(projectRoot));
}

export function readMeta(projectRoot: string): StagesMeta {
  const metaPath = getMetaPath(projectRoot);
  if (!fs.existsSync(metaPath)) {
    throw new StagesError(
      "NOT_INITIALIZED",
      "Stages is not initialized. Run `stages init` first.",
    );
  }

  const raw = JSON.parse(fs.readFileSync(metaPath, "utf8")) as Partial<StagesMeta> & {
    baseline: string;
  };
  return normalizeMeta(raw);
}

export function writeMeta(projectRoot: string, meta: StagesMeta): void {
  const metaPath = getMetaPath(projectRoot);
  const tempPath = `${metaPath}.tmp`;
  fs.mkdirSync(getStagesDir(projectRoot), { recursive: true });
  fs.writeFileSync(tempPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, metaPath);
}

export function isCurrentCycleStage(stage: StageEntry): boolean {
  return !stage.commitId;
}

export function getCurrentCycleStages(meta: StagesMeta): StageEntry[] {
  return meta.stages.filter(isCurrentCycleStage);
}

export function addStage(projectRoot: string, entry: StageEntry): void {
  const meta = readMeta(projectRoot);
  meta.stages.push(entry);
  writeMeta(projectRoot, meta);
}

export function updateStage(
  projectRoot: string,
  id: string,
  patch: Partial<StageEntry>,
): void {
  const meta = readMeta(projectRoot);
  const index = meta.stages.findIndex((stage) => stage.id === id);
  if (index === -1) {
    throw new StagesError("STAGE_NOT_FOUND", `Stage not found: ${id}`);
  }

  meta.stages[index] = { ...meta.stages[index], ...patch };
  writeMeta(projectRoot, meta);
}

export function getStage(projectRoot: string, id: string): StageEntry {
  const meta = readMeta(projectRoot);
  const stage = meta.stages.find((item) => item.id === id);
  if (!stage) {
    throw new StagesError("STAGE_NOT_FOUND", `Stage not found: ${id}`);
  }
  return stage;
}

export function findStages(
  projectRoot: string,
  filter?: { all?: boolean },
): StageEntry[] {
  const meta = readMeta(projectRoot);
  const stages = [...meta.stages];

  if (filter?.all) {
    return stages;
  }

  return stages.filter(
    (stage) =>
      isCurrentCycleStage(stage) &&
      !stage.hidden &&
      stage.status !== "merged",
  );
}

export function rewirePrevPointers(
  projectRoot: string,
  absorbedIds: string[],
  survivorId: string,
): void {
  if (absorbedIds.length === 0) {
    return;
  }

  const meta = readMeta(projectRoot);
  const absorbedSet = new Set(absorbedIds);
  let changed = false;

  for (const stage of meta.stages) {
    if (stage.prev && absorbedSet.has(stage.prev)) {
      stage.prev = survivorId;
      changed = true;
    }
  }

  if (changed) {
    writeMeta(projectRoot, meta);
  }
}

export function incrementNextId(projectRoot: string): number {
  const meta = readMeta(projectRoot);
  const id = meta.nextId;
  meta.nextId += 1;
  writeMeta(projectRoot, meta);
  return id;
}

export function incrementNextCommitId(projectRoot: string): number {
  const meta = readMeta(projectRoot);
  const id = meta.nextCommitId;
  meta.nextCommitId += 1;
  writeMeta(projectRoot, meta);
  return id;
}

export function getActiveStages(meta: StagesMeta): StageEntry[] {
  return getCurrentCycleStages(meta).filter((stage) => stage.status !== "merged");
}

export function getLatestActiveStage(meta: StagesMeta): StageEntry | undefined {
  const active = getActiveStages(meta);
  if (active.length === 0) {
    return undefined;
  }

  return active.reduce((latest, current) =>
    current.createdAt > latest.createdAt ? current : latest,
  );
}

export function getLatestStage(meta: StagesMeta): StageEntry | undefined {
  const cycleStages = getCurrentCycleStages(meta);
  if (cycleStages.length === 0) {
    return undefined;
  }

  return cycleStages.reduce((latest, current) =>
    current.createdAt > latest.createdAt ? current : latest,
  );
}

export function addCommit(projectRoot: string, entry: CommitEntry): void {
  const meta = readMeta(projectRoot);
  meta.commits.push(entry);
  writeMeta(projectRoot, meta);
}

export function listCommits(meta: StagesMeta): CommitEntry[] {
  return [...meta.commits];
}

export function getCommit(projectRoot: string, commitId: string): CommitEntry {
  const meta = readMeta(projectRoot);
  const commit = meta.commits.find((item) => item.id === commitId);
  if (!commit) {
    throw new StagesError("COMMIT_NOT_FOUND", `Commit not found: ${commitId}`);
  }
  return commit;
}

export function archiveCurrentCycle(
  projectRoot: string,
  commitId: string,
  baselineManifestPath: string,
): void {
  const meta = readMeta(projectRoot);

  for (const stage of meta.stages) {
    if (!stage.commitId) {
      stage.status = "committed";
      stage.hidden = true;
      stage.commitId = commitId;
    }
  }

  meta.baselineManifestPath = baselineManifestPath;
  meta.nextId = 1;
  writeMeta(projectRoot, meta);
}

export function removeStages(projectRoot: string, ids: string[]): void {
  if (ids.length === 0) {
    return;
  }

  const meta = readMeta(projectRoot);
  const idSet = new Set(ids);
  meta.stages = meta.stages.filter((stage) => !idSet.has(stage.id));
  writeMeta(projectRoot, meta);
}

export function createInitialMeta(baseline: string): StagesMeta {
  return {
    version: 1,
    baseline,
    baselineManifestPath: null,
    nextId: 1,
    nextCommitId: 1,
    stages: [],
    commits: [],
  };
}

export function formatNextCommitId(projectRoot: string): string {
  const meta = readMeta(projectRoot);
  return formatCommitId(meta.nextCommitId);
}
