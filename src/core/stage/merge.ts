import type { StageEntry } from "../../types/index.js";
import { StagesError } from "../errors.js";
import { resolveCumulative } from "../diff/resolver.js";
import {
  areContiguousIds,
  normalizeStageInput,
  parseStageNumber,
  suggestContiguousRange,
} from "../store/id.js";
import { copyManifest, readManifest } from "../store/manifest.js";
import {
  getStage,
  readMeta,
  rewirePrevPointers,
  updateStage,
} from "../store/meta.js";

function validateMergeInputs(
  projectRoot: string,
  resolvedIds: string[],
): StageEntry[] {
  if (resolvedIds.length < 2) {
    throw new StagesError(
      "MERGE_TOO_FEW",
      "At least two stages are required to merge.",
    );
  }

  if (!areContiguousIds(resolvedIds)) {
    const suggestion = suggestContiguousRange(resolvedIds);
    throw new StagesError(
      "MERGE_NOT_CONTIGUOUS",
      suggestion
        ? `Cannot merge non-contiguous stages. Did you mean: ${suggestion}?`
        : "Cannot merge non-contiguous stages.",
    );
  }

  const stages = resolvedIds.map((id) => getStage(projectRoot, id));
  for (const stage of stages) {
    if (stage.status === "committed" || stage.status === "merged") {
      throw new StagesError(
        "MERGE_INVALID_STATUS",
        `Cannot merge stage ${stage.id} with status ${stage.status}.`,
      );
    }
  }

  return stages.sort(
    (a, b) => parseStageNumber(a.id)! - parseStageNumber(b.id)!,
  );
}

export async function merge(
  projectRoot: string,
  ids: string[],
  name: string,
): Promise<StageEntry> {
  if (!name.trim()) {
    throw new StagesError("MERGE_NAME_REQUIRED", "Merge requires --name option.");
  }

  const meta = readMeta(projectRoot);
  const resolvedIds = ids.map((id) => normalizeStageInput(id));
  const sourceStages = validateMergeInputs(projectRoot, resolvedIds);
  const firstSource = sourceStages[0];
  const lastSource = sourceStages[sourceStages.length - 1];
  const survivorId = firstSource.id;
  const absorbedIds = sourceStages.slice(1).map((stage) => stage.id);

  copyManifest(
    projectRoot,
    lastSource.id,
    survivorId,
    firstSource.createdAt,
  );

  updateStage(projectRoot, survivorId, {
    name: name.trim(),
    mergedFrom: resolvedIds,
    stats: {
      files: 0,
      additions: 0,
      deletions: 0,
    },
  });

  for (const absorbedId of absorbedIds) {
    updateStage(projectRoot, absorbedId, {
      status: "merged",
      mergedInto: survivorId,
      hidden: true,
    });
  }

  rewirePrevPointers(projectRoot, absorbedIds, survivorId);

  const diffResult = resolveCumulative(projectRoot, survivorId);
  updateStage(projectRoot, survivorId, { stats: diffResult.stats });

  return { ...getStage(projectRoot, survivorId), stats: diffResult.stats };
}

export function getMergedManifestSource(
  projectRoot: string,
  stageId: string,
): string {
  const stage = getStage(projectRoot, stageId);
  if (stage.mergedFrom && stage.mergedFrom.length > 0) {
    return stage.mergedFrom[stage.mergedFrom.length - 1];
  }
  return stageId;
}

export function readStageManifest(projectRoot: string, stageId: string) {
  return readManifest(projectRoot, stageId);
}
