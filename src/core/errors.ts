import type { ErrorCode } from "../types/index.js";

export class StagesError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "StagesError";
    this.code = code;
  }
}

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  NOT_GIT_REPO: "Not a git repository. Run `git init` first.",
  NOT_INITIALIZED: "Stages is not initialized. Run `stages init` first.",
  STAGE_NOT_FOUND: "Stage not found.",
  MERGE_NOT_CONTIGUOUS: "Cannot merge non-contiguous stages.",
  MERGE_INVALID_STATUS: "Cannot merge stages with invalid status.",
  MERGE_TOO_FEW: "At least two stages are required to merge.",
  MERGE_NAME_REQUIRED: "Merge requires --name option.",
  DIRTY_WORKTREE: "Working tree has uncommitted changes.",
  GIT_NOT_FOUND: "Git is not installed or not available in PATH.",
  BLOB_CORRUPT: "Blob data is corrupted.",
  INVALID_RENAME: "Cannot rename this stage.",
  INVALID_HIDE: "Cannot hide this stage.",
  INVALID_COMMIT: "Cannot commit this stage.",
  ALREADY_INITIALIZED: "Stages is already initialized.",
  PATH_TRAVERSAL: "Invalid file path detected.",
  SNAP_NO_CHANGES: "No new changes to save.",
  COMMIT_MESSAGE_REQUIRED: "Commit requires -m option.",
  COMMIT_NO_STAGES: "No stages to commit in the current cycle.",
  COMMIT_NOT_FOUND: "Commit not found.",
  DROP_INVALID_STATUS: "Cannot drop this stage.",
  DROP_CANCELLED: "Drop cancelled.",
};
