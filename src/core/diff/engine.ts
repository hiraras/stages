import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Manifest, StagesMeta } from "../../types/index.js";
import { getBaselineManifest } from "../baseline.js";
import { gitExec } from "../git/exec.js";
import { getFileAtCommit } from "../git/head.js";
import { readBlob } from "../store/blob.js";
import { assertSafeRelativePath, resolveWithinProject } from "../paths.js";

export function materializeManifest(
  projectRoot: string,
  manifest: Manifest,
  targetDir: string,
): void {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const [relativePath, entry] of Object.entries(manifest.files)) {
    assertSafeRelativePath(relativePath);
    const absolutePath = path.join(targetDir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    const content = readBlob(projectRoot, entry.hash);
    fs.writeFileSync(absolutePath, content);
  }
}

export function writeFileToDir(targetDir: string, relativePath: string, content: Buffer | null): void {
  assertSafeRelativePath(relativePath);
  const absolutePath = path.join(targetDir, relativePath);

  if (content === null) {
    return;
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

export function diffFiles(
  projectRoot: string,
  oldContent: Buffer | null,
  newContent: Buffer | null,
  filePath: string,
): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stages-diff-"));

  try {
    const oldPath = path.join(tempRoot, "old", filePath);
    const newPath = path.join(tempRoot, "new", filePath);

    if (oldContent !== null) {
      writeFileToDir(path.join(tempRoot, "old"), filePath, oldContent);
    } else {
      fs.mkdirSync(path.dirname(oldPath), { recursive: true });
      fs.writeFileSync(oldPath, "");
    }

    if (newContent !== null) {
      writeFileToDir(path.join(tempRoot, "new"), filePath, newContent);
    } else {
      fs.mkdirSync(path.dirname(newPath), { recursive: true });
      fs.writeFileSync(newPath, "");
    }

    // Use placeholder files instead of os.devNull — git on Windows cannot
    // access \\.\nul, which would yield empty diffs for added/deleted files.
    return gitExec(projectRoot, [
      "diff",
      "--no-index",
      "--",
      oldPath,
      newPath,
    ], { allowFailure: true });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function getBaselineFileContent(
  projectRoot: string,
  meta: StagesMeta,
  filePath: string,
): Buffer | null {
  const baselineManifest = getBaselineManifest(projectRoot, meta);
  if (baselineManifest) {
    return getManifestFileContent(projectRoot, baselineManifest, filePath);
  }

  return getFileAtCommit(projectRoot, meta.baseline, filePath);
}

export function getManifestFileContent(
  projectRoot: string,
  manifest: Manifest,
  filePath: string,
): Buffer | null {
  const entry = manifest.files[filePath];
  if (!entry) {
    return null;
  }
  return readBlob(projectRoot, entry.hash);
}

export function applyManifestToWorktree(
  projectRoot: string,
  manifest: Manifest,
): void {
  for (const [relativePath, entry] of Object.entries(manifest.files)) {
    const absolutePath = resolveWithinProject(projectRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, readBlob(projectRoot, entry.hash));
  }
}

export function applyManifestDiffToWorktree(
  projectRoot: string,
  baselineManifest: Manifest,
  targetManifest: Manifest,
): void {
  const targetPaths = new Set(Object.keys(targetManifest.files));
  const baselinePaths = new Set(Object.keys(baselineManifest.files));

  for (const filePath of targetPaths) {
    const absolutePath = resolveWithinProject(projectRoot, filePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      getManifestFileContent(projectRoot, targetManifest, filePath)!,
    );
  }

  for (const filePath of baselinePaths) {
    if (!targetPaths.has(filePath)) {
      const absolutePath = resolveWithinProject(projectRoot, filePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }
  }
}

export function applyCumulativeToWorktree(
  projectRoot: string,
  meta: StagesMeta,
  manifest: Manifest,
): void {
  const baselineManifest = getBaselineManifest(projectRoot, meta);
  if (baselineManifest) {
    applyManifestDiffToWorktree(projectRoot, baselineManifest, manifest);
    return;
  }

  applyCumulativeToGitBaseline(projectRoot, meta.baseline, manifest);
}

export function applyCumulativeToGitBaseline(
  projectRoot: string,
  baseline: string,
  manifest: Manifest,
): void {
  const manifestPaths = new Set(Object.keys(manifest.files));

  for (const filePath of manifestPaths) {
    const absolutePath = resolveWithinProject(projectRoot, filePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      getManifestFileContent(projectRoot, manifest, filePath)!,
    );
  }

  const baselineFiles = listTrackedFilesAtCommit(projectRoot, baseline);
  for (const filePath of baselineFiles) {
    if (!manifestPaths.has(filePath)) {
      const absolutePath = resolveWithinProject(projectRoot, filePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }
  }
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
