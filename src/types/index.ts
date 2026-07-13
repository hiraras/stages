export type StageStatus = "pending" | "merged" | "ready" | "committed";

export interface StageStats {
  files: number;
  additions: number;
  deletions: number;
}

export interface StageEntry {
  id: string;
  name: string;
  status: StageStatus;
  manifestPath: string;
  createdAt: string;
  prev: string | null;
  mergedFrom?: string[];
  mergedInto?: string;
  commitId?: string;
  hidden: boolean;
  stats: StageStats;
}

export interface CommitEntry {
  id: string;
  name: string;
  createdAt: string;
  manifestPath: string;
  stageIds: string[];
  stats: StageStats;
}

export interface StagesMeta {
  version: 1;
  baseline: string;
  baselineManifestPath: string | null;
  nextId: number;
  nextCommitId: number;
  stages: StageEntry[];
  commits: CommitEntry[];
}

export interface ManifestFileEntry {
  hash: string;
  mode: string;
}

export interface Manifest {
  stageId: string;
  createdAt: string;
  files: Record<string, ManifestFileEntry>;
}

export type FileChangeType = "added" | "modified" | "deleted";

export interface FileChangeEntry {
  path: string;
  type: FileChangeType;
}

export interface FileDiff {
  path: string;
  type: FileChangeType;
  diff: string;
}

export interface DiffResult {
  stageId: string;
  files: FileDiff[];
  stats: StageStats;
}

export interface StatusSummary {
  baseline: string;
  total: number;
  byStatus: Record<StageStatus, number>;
  latest?: StageEntry;
}

export type VerifySkipReason = "not_initialized" | "no_stages";

export type VerifyFailReason = "uncommitted_stages" | "dirty_worktree";

export type VerifyResult =
  | { status: "skipped"; reason: VerifySkipReason }
  | { status: "ok" }
  | {
      status: "failed";
      reason: VerifyFailReason;
      uncommittedStages?: StageEntry[];
      dirtyFiles?: DirtyFile[];
    };

export interface ScannedFile {
  relativePath: string;
  content: Buffer;
  mode: string;
}

export interface DirtyFile {
  path: string;
  reason: "modified" | "added" | "deleted";
}

export type ErrorCode =
  | "NOT_GIT_REPO"
  | "NOT_INITIALIZED"
  | "STAGE_NOT_FOUND"
  | "MERGE_NOT_CONTIGUOUS"
  | "MERGE_INVALID_STATUS"
  | "MERGE_TOO_FEW"
  | "MERGE_NAME_REQUIRED"
  | "DIRTY_WORKTREE"
  | "GIT_NOT_FOUND"
  | "BLOB_CORRUPT"
  | "INVALID_RENAME"
  | "INVALID_HIDE"
  | "INVALID_COMMIT"
  | "ALREADY_INITIALIZED"
  | "PATH_TRAVERSAL"
  | "SNAP_NO_CHANGES"
  | "COMMIT_MESSAGE_REQUIRED"
  | "COMMIT_NO_STAGES"
  | "COMMIT_NOT_FOUND"
  | "DROP_INVALID_STATUS"
  | "DROP_STAGE_NOT_FOUND"
  | "DROP_CANCELLED";

export interface UnstagedResult {
  files: FileChangeEntry[];
  referenceStageId: string | null;
}

export interface DropRestoreTarget {
  kind: "stage";
  stageId: string;
  stageName: string;
}

export interface DropBaselineTarget {
  kind: "baseline";
}

export type DropTarget = DropRestoreTarget | DropBaselineTarget;

export interface DropPlan {
  targetId: string;
  droppedStages: StageEntry[];
  restoreTarget: DropTarget;
  restoreManifest: Manifest;
  affectedFiles: FileChangeEntry[];
}

export interface DropResult {
  droppedIds: string[];
  restoreTarget: DropTarget;
  affectedFiles: FileChangeEntry[];
}

export interface StagesAPI {
  init(projectRoot: string): Promise<{
    alreadyInitialized: boolean;
    gitignoreUpdated: boolean;
    initialStage?: StageEntry;
  }>;
  snap(
    projectRoot: string,
    opts?: { message?: string },
  ): Promise<StageEntry>;
  list(projectRoot: string, opts?: { all?: boolean }): Promise<StageEntry[]>;
  show(
    projectRoot: string,
    stageId: string,
    opts?: { stat?: boolean },
  ): DiffResult;
  merge(
    projectRoot: string,
    ids: string[],
    name: string,
  ): Promise<StageEntry>;
  rename(
    projectRoot: string,
    stageId: string,
    newName: string,
  ): Promise<void>;
  commit(
    projectRoot: string,
    opts: { message: string; force?: boolean },
  ): Promise<CommitEntry>;
  planDrop(projectRoot: string, stageId: string): DropPlan;
  drop(
    projectRoot: string,
    stageId: string,
    opts?: { force?: boolean },
  ): Promise<DropResult>;
  verify(projectRoot: string): Promise<VerifyResult>;
  log(projectRoot: string): Promise<CommitEntry[]>;
  hide(projectRoot: string, stageId: string): Promise<void>;
  unhide(projectRoot: string, stageId: string): Promise<void>;
  status(projectRoot: string): Promise<StatusSummary>;
  listUnstaged(projectRoot: string): Promise<UnstagedResult>;
  readFile(
    projectRoot: string,
    stageId: string,
    filePath: string,
  ): Promise<Buffer | null>;
  readCommitFile(
    projectRoot: string,
    commitId: string,
    filePath: string,
  ): Promise<Buffer | null>;
  getPrevStageId(projectRoot: string, stageId: string): Promise<string | null>;
  getPrevCommitId(projectRoot: string, commitId: string): Promise<string | null>;
  readBaselineFile(
    projectRoot: string,
    filePath: string,
  ): Promise<Buffer | null>;
}
