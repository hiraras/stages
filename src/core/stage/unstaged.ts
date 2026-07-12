import type { UnstagedResult } from "../../types/index.js";
import { getBaselineManifest } from "../baseline.js";
import { detectDirtyFiles } from "../git/dirty.js";
import { readManifest } from "../store/manifest.js";
import { getLatestActiveStage, isInitialized, readMeta } from "../store/meta.js";

export async function listUnstaged(projectRoot: string): Promise<UnstagedResult> {
  if (!isInitialized(projectRoot)) {
    return { files: [], referenceStageId: null };
  }

  const meta = readMeta(projectRoot);
  const latest = getLatestActiveStage(meta);
  if (latest) {
    const manifest = readManifest(projectRoot, latest.id);
    const dirty = await detectDirtyFiles(projectRoot, manifest);
    return {
      files: dirty.map((file) => ({ path: file.path, type: file.reason })),
      referenceStageId: latest.id,
    };
  }

  const baselineManifest = getBaselineManifest(projectRoot, meta);
  if (!baselineManifest) {
    return { files: [], referenceStageId: null };
  }

  const dirty = await detectDirtyFiles(projectRoot, baselineManifest);
  return {
    files: dirty.map((file) => ({ path: file.path, type: file.reason })),
    referenceStageId: null,
  };
}
