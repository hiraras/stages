import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import ignore from "ignore";
import type { ScannedFile } from "../../types/index.js";
import { toPosixPath } from "../paths.js";

const DEFAULT_IGNORE = [
  ".git/**",
  ".stages/**",
  "node_modules/**",
];

function loadGitignore(projectRoot: string): ReturnType<typeof ignore> {
  const ig = ignore().add(DEFAULT_IGNORE);
  const gitignorePath = path.join(projectRoot, ".gitignore");

  if (fs.existsSync(gitignorePath)) {
    ig.add(fs.readFileSync(gitignorePath, "utf8"));
  }

  return ig;
}

export async function scanWorkspace(projectRoot: string): Promise<ScannedFile[]> {
  const ig = loadGitignore(projectRoot);
  const entries = await fg("**/*", {
    cwd: projectRoot,
    onlyFiles: true,
    dot: true,
    absolute: false,
    followSymbolicLinks: false,
  });

  const scanned: ScannedFile[] = [];

  for (const relativePath of entries) {
    const posixPath = toPosixPath(relativePath);
    if (ig.ignores(posixPath)) {
      continue;
    }

    const absolutePath = path.join(projectRoot, relativePath);
    const content = fs.readFileSync(absolutePath);
    scanned.push({
      relativePath: posixPath,
      content,
      mode: "100644",
    });
  }

  scanned.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return scanned;
}

export function buildManifestMap(
  scanned: ScannedFile[],
  storeBlobFn: (content: Buffer) => string,
): Record<string, { hash: string; mode: string }> {
  const files: Record<string, { hash: string; mode: string }> = {};

  for (const file of scanned) {
    files[file.relativePath] = {
      hash: storeBlobFn(file.content),
      mode: file.mode,
    };
  }

  return files;
}
