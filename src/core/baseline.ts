import type { Manifest, StagesMeta } from "../types/index.js";
import { readManifest } from "./store/manifest.js";

export function getBaselineManifest(
  projectRoot: string,
  meta: StagesMeta,
): Manifest | null {
  if (!meta.baselineManifestPath) {
    return null;
  }

  return readManifest(projectRoot, meta.baselineManifestPath);
}

export function usesManifestBaseline(meta: StagesMeta): boolean {
  return meta.baselineManifestPath !== null;
}
