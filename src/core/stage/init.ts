import fs from "node:fs";
import path from "node:path";
import type { CommitEntry, Manifest } from "../../types/index.js";
import { resolveCommit } from "../diff/resolver.js";
import { StagesError } from "../errors.js";
import { getHeadCommit } from "../git/head.js";
import { isGitRepo } from "../git/worktree.js";
import {
  getBlobsDir,
  getCommitManifestDir,
  getManifestsDir,
} from "../paths.js";
import { buildManifestMap, scanWorkspace } from "../scanner/files.js";
import { storeBlob } from "../store/blob.js";
import { formatCommitId } from "../store/id.js";
import { writeManifest } from "../store/manifest.js";
import {
  addCommit,
  archiveCurrentCycle,
  createInitialMeta,
  incrementNextCommitId,
  isInitialized,
  readMeta,
  writeMeta,
} from "../store/meta.js";

const DEFAULT_INIT_COMMIT_NAME = "init";

function ensureGitignore(projectRoot: string): boolean {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  const entry = ".stages/";
  let updated = false;

  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, `${entry}\n`, "utf8");
    return true;
  }

  const content = fs.readFileSync(gitignorePath, "utf8");
  const lines = content.split("\n");
  const hasEntry = lines.some(
    (line) => line.trim() === ".stages" || line.trim() === ".stages/",
  );

  if (!hasEntry) {
    const suffix = content.endsWith("\n") ? "" : "\n";
    fs.appendFileSync(gitignorePath, `${suffix}${entry}\n`, "utf8");
    updated = true;
  }

  return updated;
}

/**
 * Snapshot the current worktree as commit-001 (or next), set cycle baseline to it.
 * Does not create stages and does not rewrite the worktree.
 */
async function createInitCommit(
  projectRoot: string,
  name: string,
): Promise<CommitEntry> {
  const scanned = await scanWorkspace(projectRoot);
  const files = buildManifestMap(scanned, (content) =>
    storeBlob(projectRoot, content),
  );

  const commitSequence = incrementNextCommitId(projectRoot);
  const commitId = formatCommitId(commitSequence);
  const createdAt = new Date().toISOString();
  const manifestPath = `commits/${commitId}.json`;

  fs.mkdirSync(getCommitManifestDir(projectRoot), { recursive: true });
  const commitManifest: Manifest = {
    stageId: manifestPath,
    createdAt,
    files,
  };
  writeManifest(projectRoot, commitManifest);

  const entry: CommitEntry = {
    id: commitId,
    name,
    createdAt,
    manifestPath,
    stageIds: [],
    stats: { files: 0, additions: 0, deletions: 0 },
  };

  addCommit(projectRoot, entry);
  archiveCurrentCycle(projectRoot, commitId, manifestPath);

  const diffResult = resolveCommit(projectRoot, commitId);
  const withStats: CommitEntry = { ...entry, stats: diffResult.stats };
  const meta = readMeta(projectRoot);
  const index = meta.commits.findIndex((item) => item.id === commitId);
  if (index !== -1) {
    meta.commits[index] = withStats;
    writeMeta(projectRoot, meta);
  }

  return withStats;
}

export async function init(
  projectRoot: string,
  opts?: { message?: string },
): Promise<{
  alreadyInitialized: boolean;
  gitignoreUpdated: boolean;
  initialCommit?: CommitEntry;
}> {
  if (!isGitRepo(projectRoot)) {
    throw new StagesError(
      "NOT_GIT_REPO",
      "Not a git repository. Run `git init` first.",
    );
  }

  if (isInitialized(projectRoot)) {
    return { alreadyInitialized: true, gitignoreUpdated: false };
  }

  fs.mkdirSync(getBlobsDir(projectRoot), { recursive: true });
  fs.mkdirSync(getManifestsDir(projectRoot), { recursive: true });

  const meta = createInitialMeta(getHeadCommit(projectRoot));
  writeMeta(projectRoot, meta);
  const gitignoreUpdated = ensureGitignore(projectRoot);

  const message = opts?.message?.trim() || DEFAULT_INIT_COMMIT_NAME;
  const initialCommit = await createInitCommit(projectRoot, message);

  return { alreadyInitialized: false, gitignoreUpdated, initialCommit };
}

export function assertInitialized(projectRoot: string): void {
  if (!isInitialized(projectRoot)) {
    throw new StagesError(
      "NOT_INITIALIZED",
      "Stages is not initialized. Run `stages init` first.",
    );
  }
}

export function getBaseline(projectRoot: string): string {
  return readMeta(projectRoot).baseline;
}
