import path from "node:path";

export const STAGES_DIR = ".stages";

export function getStagesDir(projectRoot: string): string {
  return path.join(projectRoot, STAGES_DIR);
}

export function getMetaPath(projectRoot: string): string {
  return path.join(getStagesDir(projectRoot), "meta.json");
}

export function getBlobsDir(projectRoot: string): string {
  return path.join(getStagesDir(projectRoot), "blobs");
}

export function getManifestsDir(projectRoot: string): string {
  return path.join(getStagesDir(projectRoot), "manifests");
}

export function getManifestPath(projectRoot: string, stageId: string): string {
  const fileName = stageId.includes("/") ? stageId : `${stageId}.json`;
  return path.join(getManifestsDir(projectRoot), fileName);
}

export function getCommitManifestDir(projectRoot: string): string {
  return path.join(getManifestsDir(projectRoot), "commits");
}

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function assertSafeRelativePath(relativePath: string): void {
  const normalized = path.posix.normalize(relativePath);
  if (
    normalized.startsWith("../") ||
    normalized === ".." ||
    path.isAbsolute(normalized)
  ) {
    throw new Error(`Unsafe path: ${relativePath}`);
  }
}

export function resolveWithinProject(
  projectRoot: string,
  relativePath: string,
): string {
  assertSafeRelativePath(relativePath);
  const resolved = path.resolve(projectRoot, relativePath);
  const root = path.resolve(projectRoot);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`Path escapes project root: ${relativePath}`);
  }
  return resolved;
}
