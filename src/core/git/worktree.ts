import fs from "node:fs";
import path from "node:path";
import { StagesError } from "../errors.js";
import { isInitialized } from "../store/meta.js";

export function isGitRepo(dir: string): boolean {
  return fs.existsSync(path.join(dir, ".git"));
}

export function findProjectRoot(startDir: string = process.cwd()): string {
  let current = path.resolve(startDir);

  while (true) {
    if (isGitRepo(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new StagesError(
        "NOT_GIT_REPO",
        "Not a git repository. Run `git init` first.",
      );
    }
    current = parent;
  }
}

export function isStagesInitialized(dir: string): boolean {
  return isInitialized(dir);
}
