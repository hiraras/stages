import { execFileSync } from "node:child_process";
import type { ExecFileException } from "node:child_process";
import { StagesError } from "../errors.js";

function readExecOutput(value: string | Buffer | undefined): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8").trim();
  }
  return "";
}

export function isGitInstalled(): boolean {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function gitExec(
  projectRoot: string,
  args: string[],
  options?: { allowFailure?: boolean },
): string {
  if (!isGitInstalled()) {
    throw new StagesError(
      "GIT_NOT_FOUND",
      "Git is not installed or not available in PATH.",
    );
  }

  try {
    return execFileSync("git", args, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (options?.allowFailure) {
      const execError = error as ExecFileException;
      return readExecOutput(execError.stdout);
    }
    throw error;
  }
}
