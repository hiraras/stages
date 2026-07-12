import fs from "node:fs";
import path from "node:path";
import type {
  DropPlan,
  DropResult,
  Manifest,
  StageEntry,
  StagesMeta,
} from "../../types/index.js";
import { getBaselineManifest } from "../baseline.js";
import {
  applyManifestDiffToWorktree,
} from "../diff/engine.js";
import { StagesError } from "../errors.js";
import { detectDirtyFiles } from "../git/dirty.js";
import { gitExec } from "../git/exec.js";
import { getFileAtCommit } from "../git/head.js";
import { resolveWithinProject } from "../paths.js";
import { hashContent } from "../store/blob.js";
import {
  parseStageNumber,
  resolveStageId,
} from "../store/id.js";
import {
  compareManifests,
  deleteManifest,
  readManifest,
} from "../store/manifest.js";
import {
  getCurrentCycleStages,
  readMeta,
  removeStages,
} from "../store/meta.js";

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

function getCycleStageNumber(stage: StageEntry): number {
  const number = parseStageNumber(stage.id);
  if (number === null) {
    throw new StagesError("STAGE_NOT_FOUND", `Invalid stage id: ${stage.id}`);
  }
  return number;
}

function getCurrentCycleStagesByNumber(meta: StagesMeta): StageEntry[] {
  return getCurrentCycleStages(meta).sort(
    (a, b) => getCycleStageNumber(a) - getCycleStageNumber(b),
  );
}

function validateDropEntry(stage: StageEntry): void {
  if (stage.status !== "pending" && stage.status !== "ready") {
    throw new StagesError(
      "DROP_INVALID_STATUS",
      `Cannot drop stage ${stage.id} with status ${stage.status}.`,
    );
  }
}

function collectDropSet(meta: StagesMeta, fromNumber: number): StageEntry[] {
  return getCurrentCycleStagesByNumber(meta).filter(
    (stage) => getCycleStageNumber(stage) >= fromNumber,
  );
}

function findRestoreStage(
  meta: StagesMeta,
  beforeNumber: number,
): StageEntry | undefined {
  const candidates = getCurrentCycleStagesByNumber(meta).filter((stage) => {
    if (getCycleStageNumber(stage) >= beforeNumber) {
      return false;
    }
    return stage.status === "pending" || stage.status === "ready";
  });

  if (candidates.length === 0) {
    return undefined;
  }

  return candidates[candidates.length - 1];
}

function buildGitBaselineManifest(
  projectRoot: string,
  meta: StagesMeta,
): Manifest {
  const files: Manifest["files"] = {};

  for (const filePath of listTrackedFilesAtCommit(projectRoot, meta.baseline)) {
    const content = getFileAtCommit(projectRoot, meta.baseline, filePath);
    if (content === null) {
      continue;
    }
    files[filePath] = {
      hash: hashContent(content),
      mode: "100644",
    };
  }

  return {
    stageId: "baseline",
    createdAt: "",
    files,
  };
}

function resolveRestoreTargetManifest(
  projectRoot: string,
  meta: StagesMeta,
  restoreStage: StageEntry | undefined,
): { manifest: Manifest; target: DropPlan["restoreTarget"] } {
  if (restoreStage) {
    return {
      manifest: readManifest(projectRoot, restoreStage.id),
      target: {
        kind: "stage",
        stageId: restoreStage.id,
        stageName: restoreStage.name,
      },
    };
  }

  const baselineManifest = getBaselineManifest(projectRoot, meta);
  if (baselineManifest) {
    return {
      manifest: baselineManifest,
      target: { kind: "baseline" },
    };
  }

  return {
    manifest: buildGitBaselineManifest(projectRoot, meta),
    target: { kind: "baseline" },
  };
}

function getLatestDeletedManifest(
  projectRoot: string,
  droppedStages: StageEntry[],
): Manifest {
  const latest = droppedStages[droppedStages.length - 1];
  return readManifest(projectRoot, latest.id);
}

function restoreWorktreeToTarget(
  projectRoot: string,
  meta: StagesMeta,
  fromManifest: Manifest,
  targetManifest: Manifest,
  restoreTarget: DropPlan["restoreTarget"],
): void {
  if (restoreTarget.kind === "baseline" && !getBaselineManifest(projectRoot, meta)) {
    restoreToGitBaseline(projectRoot, meta, fromManifest);
    return;
  }

  applyManifestDiffToWorktree(projectRoot, fromManifest, targetManifest);
}

function restoreToGitBaseline(
  projectRoot: string,
  meta: StagesMeta,
  fromManifest: Manifest,
): void {
  const baselinePaths = new Set(
    listTrackedFilesAtCommit(projectRoot, meta.baseline),
  );
  const fromPaths = new Set(Object.keys(fromManifest.files));

  for (const filePath of baselinePaths) {
    const content = getFileAtCommit(projectRoot, meta.baseline, filePath);
    if (content === null) {
      continue;
    }
    const absolutePath = resolveWithinProject(projectRoot, filePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }

  for (const filePath of fromPaths) {
    if (!baselinePaths.has(filePath)) {
      const absolutePath = resolveWithinProject(projectRoot, filePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }
  }
}

export function planDrop(projectRoot: string, inputId: string): DropPlan {
  const meta = readMeta(projectRoot);
  const resolvedId = resolveStageId(meta, inputId);
  const targetStage = meta.stages.find((stage) => stage.id === resolvedId);
  if (!targetStage) {
    throw new StagesError("STAGE_NOT_FOUND", `Stage not found: ${resolvedId}`);
  }

  validateDropEntry(targetStage);

  const fromNumber = getCycleStageNumber(targetStage);
  const droppedStages = collectDropSet(meta, fromNumber);
  if (droppedStages.length === 0) {
    throw new StagesError("STAGE_NOT_FOUND", `Stage not found: ${resolvedId}`);
  }

  for (const stage of droppedStages) {
    if (stage.status === "committed") {
      throw new StagesError(
        "DROP_INVALID_STATUS",
        `Cannot drop committed stage ${stage.id}.`,
      );
    }
  }

  const restoreStage = findRestoreStage(meta, fromNumber);
  const { manifest: restoreManifest, target: restoreTarget } =
    resolveRestoreTargetManifest(projectRoot, meta, restoreStage);
  const fromManifest = getLatestDeletedManifest(projectRoot, droppedStages);
  const affectedFiles = compareManifests(fromManifest, restoreManifest);

  return {
    targetId: resolvedId,
    droppedStages,
    restoreTarget,
    restoreManifest,
    affectedFiles,
  };
}

export async function drop(
  projectRoot: string,
  inputId: string,
  opts?: { force?: boolean },
): Promise<DropResult> {
  const plan = planDrop(projectRoot, inputId);

  if (!opts?.force) {
    const dirty = await detectDirtyFiles(projectRoot, plan.restoreManifest);
    if (dirty.length > 0) {
      throw new StagesError(
        "DIRTY_WORKTREE",
        "Working tree has uncommitted changes.",
      );
    }
  }

  const meta = readMeta(projectRoot);
  const fromManifest = getLatestDeletedManifest(projectRoot, plan.droppedStages);
  restoreWorktreeToTarget(
    projectRoot,
    meta,
    fromManifest,
    plan.restoreManifest,
    plan.restoreTarget,
  );

  const droppedIds = plan.droppedStages.map((stage) => stage.id);
  removeStages(projectRoot, droppedIds);
  for (const stageId of droppedIds) {
    deleteManifest(projectRoot, stageId);
  }

  return {
    droppedIds,
    restoreTarget: plan.restoreTarget,
    affectedFiles: plan.affectedFiles,
  };
}
