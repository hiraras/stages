import fs from "node:fs";
import type {
  FileChangeEntry,
  FileChangeType,
  Manifest,
} from "../../types/index.js";
import path from "node:path";
import { getManifestPath, getManifestsDir } from "../paths.js";

export function writeManifest(projectRoot: string, manifest: Manifest): void {
  const manifestPath = getManifestPath(projectRoot, manifest.stageId);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function readManifest(projectRoot: string, stageId: string): Manifest {
  const manifestPath = getManifestPath(projectRoot, stageId);
  const raw = fs.readFileSync(manifestPath, "utf8");
  return JSON.parse(raw) as Manifest;
}

export function compareManifests(
  oldManifest: Manifest | null,
  newManifest: Manifest,
): FileChangeEntry[] {
  const changes: FileChangeEntry[] = [];
  const oldFiles = oldManifest?.files ?? {};
  const newFiles = newManifest.files;

  for (const filePath of Object.keys(newFiles)) {
    const oldEntry = oldFiles[filePath];
    const newEntry = newFiles[filePath];

    if (!oldEntry) {
      changes.push({ path: filePath, type: "added" });
      continue;
    }

    if (oldEntry.hash !== newEntry.hash) {
      changes.push({ path: filePath, type: "modified" });
    }
  }

  for (const filePath of Object.keys(oldFiles)) {
    if (!newFiles[filePath]) {
      changes.push({ path: filePath, type: "deleted" });
    }
  }

  changes.sort((a, b) => a.path.localeCompare(b.path));
  return changes;
}

export function deleteManifest(projectRoot: string, stageId: string): void {
  const manifestPath = getManifestPath(projectRoot, stageId);
  if (fs.existsSync(manifestPath)) {
    fs.unlinkSync(manifestPath);
  }
}

export function copyManifest(
  projectRoot: string,
  sourceStageId: string,
  targetStageId: string,
  createdAt: string,
): Manifest {
  const source = readManifest(projectRoot, sourceStageId);
  const manifest: Manifest = {
    stageId: targetStageId,
    createdAt,
    files: { ...source.files },
  };
  writeManifest(projectRoot, manifest);
  return manifest;
}

export function emptyStats() {
  return { files: 0, additions: 0, deletions: 0 };
}

export function changeTypeLabel(type: FileChangeType): string {
  switch (type) {
    case "added":
      return "A";
    case "modified":
      return "M";
    case "deleted":
      return "D";
  }
}
