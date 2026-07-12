import { gitExec } from "./exec.js";

export function getHeadCommit(projectRoot: string): string {
  return gitExec(projectRoot, ["rev-parse", "HEAD"]);
}

export function getFileAtCommit(
  projectRoot: string,
  commit: string,
  filePath: string,
): Buffer | null {
  try {
    const content = gitExec(projectRoot, ["show", `${commit}:${filePath}`]);
    return Buffer.from(content, "utf8");
  } catch {
    return null;
  }
}

export function getGitStatusPorcelain(projectRoot: string): string {
  return gitExec(projectRoot, ["status", "--porcelain"], { allowFailure: true });
}

export function hasWorkspaceChangesVsHead(projectRoot: string): boolean {
  return getGitStatusPorcelain(projectRoot).trim().length > 0;
}

export function listChangedFilesVsHead(projectRoot: string): string[] {
  const diff = gitExec(projectRoot, ["diff", "--name-only", "HEAD"], {
    allowFailure: true,
  });
  const untracked = gitExec(
    projectRoot,
    ["ls-files", "--others", "--exclude-standard"],
    { allowFailure: true },
  );

  const files = new Set<string>([
    ...diff.split("\n").filter(Boolean),
    ...untracked.split("\n").filter(Boolean),
  ]);

  return [...files].sort((a, b) => a.localeCompare(b));
}
