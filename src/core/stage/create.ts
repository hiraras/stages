import type { Manifest, StageEntry } from "../../types/index.js";
import { getChangesFromBaseline, resolveIncrementalForPrev } from "../diff/resolver.js";
import { StagesError } from "../errors.js";
import { hashContent, storeBlob } from "../store/blob.js";
import { formatStageId } from "../store/id.js";
import {
  compareManifests,
  readManifest,
  writeManifest,
} from "../store/manifest.js";
import {
  addStage,
  getLatestActiveStage,
  incrementNextId,
  readMeta,
} from "../store/meta.js";
import { buildManifestMap, scanWorkspace } from "../scanner/files.js";

async function buildTentativeManifest(projectRoot: string): Promise<Manifest> {
  const scanned = await scanWorkspace(projectRoot);
  const files: Manifest["files"] = {};

  for (const file of scanned) {
    files[file.relativePath] = {
      hash: hashContent(file.content),
      mode: file.mode,
    };
  }

  return {
    stageId: "pending",
    createdAt: "",
    files,
  };
}

function assertHasNewChanges(
  projectRoot: string,
  meta: ReturnType<typeof readMeta>,
  latest: StageEntry | undefined,
  tentative: Manifest,
): void {
  if (latest) {
    const prevManifest = readManifest(projectRoot, latest.id);
    const changes = compareManifests(prevManifest, tentative);
    if (changes.length === 0) {
      throw new StagesError("SNAP_NO_CHANGES", "No new changes.");
    }
    return;
  }

  const changes = getChangesFromBaseline(projectRoot, meta, tentative);
  if (changes.length === 0) {
    throw new StagesError("SNAP_NO_CHANGES", "No new changes.");
  }
}

export async function createStage(
  projectRoot: string,
  opts?: { message?: string },
): Promise<StageEntry> {
  const sequence = incrementNextId(projectRoot);
  const stageId = formatStageId(sequence);
  const createdAt = new Date().toISOString();
  const latest = getLatestActiveStage(readMeta(projectRoot));

  const scanned = await scanWorkspace(projectRoot);
  const files = buildManifestMap(scanned, (content) =>
    storeBlob(projectRoot, content),
  );

  const manifest: Manifest = {
    stageId,
    createdAt,
    files,
  };

  writeManifest(projectRoot, manifest);

  const diffResult = resolveIncrementalForPrev(projectRoot, stageId, latest?.id ?? null);

  const entry: StageEntry = {
    id: stageId,
    name: opts?.message?.trim() || stageId,
    status: "pending",
    manifestPath: `manifests/${stageId}.json`,
    createdAt,
    prev: latest?.id ?? null,
    hidden: false,
    stats: diffResult.stats,
  };

  addStage(projectRoot, entry);

  return entry;
}

export async function snap(
  projectRoot: string,
  opts?: { message?: string },
): Promise<StageEntry> {
  const { init } = await import("./init.js");
  await init(projectRoot);

  const meta = readMeta(projectRoot);
  const latest = getLatestActiveStage(meta);
  const tentative = await buildTentativeManifest(projectRoot);
  assertHasNewChanges(projectRoot, meta, latest, tentative);

  return createStage(projectRoot, opts);
}
