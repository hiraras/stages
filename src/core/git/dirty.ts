import type { DirtyFile, Manifest } from "../../types/index.js";
import { hashContent } from "../store/blob.js";
import { scanWorkspace } from "../scanner/files.js";

export async function detectDirtyFiles(
  projectRoot: string,
  referenceManifest: Manifest,
): Promise<DirtyFile[]> {
  const scanned = await scanWorkspace(projectRoot);
  const dirty: DirtyFile[] = [];
  const scannedMap = new Map(
    scanned.map((file) => [file.relativePath, hashContent(file.content)]),
  );
  const referencePaths = new Set(Object.keys(referenceManifest.files));

  for (const file of scanned) {
    const reference = referenceManifest.files[file.relativePath];
    const currentHash = hashContent(file.content);

    if (!reference) {
      dirty.push({ path: file.relativePath, reason: "added" });
      continue;
    }

    if (reference.hash !== currentHash) {
      dirty.push({ path: file.relativePath, reason: "modified" });
    }
  }

  for (const filePath of referencePaths) {
    if (!scannedMap.has(filePath)) {
      dirty.push({ path: filePath, reason: "deleted" });
    }
  }

  dirty.sort((a, b) => a.path.localeCompare(b.path));
  return dirty;
}
