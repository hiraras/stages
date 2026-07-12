import fs from "node:fs";
import path from "node:path";
import type { StageEntry } from "../../types/index.js";
import { getHeadCommit } from "../git/head.js";
import { isGitRepo } from "../git/worktree.js";
import { StagesError } from "../errors.js";
import {
  getBlobsDir,
  getManifestsDir,
} from "../paths.js";
import { createInitialMeta, isInitialized, readMeta, writeMeta } from "../store/meta.js";
import { createInitialStageIfNeeded } from "./create.js";

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

export async function init(
  projectRoot: string,
): Promise<{
  alreadyInitialized: boolean;
  gitignoreUpdated: boolean;
  initialStage?: StageEntry;
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
  const initialStage = await createInitialStageIfNeeded(projectRoot);

  return { alreadyInitialized: false, gitignoreUpdated, initialStage: initialStage ?? undefined };
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
