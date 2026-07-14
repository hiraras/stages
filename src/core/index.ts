import type { StagesAPI } from "../types/index.js";
import { snap } from "./stage/create.js";
import { init } from "./stage/init.js";
import { merge } from "./stage/merge.js";
import { commit } from "./stage/commit.js";
import { verify } from "./stage/verify.js";
import { log } from "./stage/log.js";
import {
  list,
  rename,
  status,
  readFile,
  readCommitFile,
  getPrevStageId,
  getPrevCommitId,
  readBaselineFile,
  readGitHeadFile,
} from "./stage/lifecycle.js";
import { drop, planDrop } from "./stage/drop.js";
import { show } from "./stage/show.js";
import { listUnstaged } from "./stage/unstaged.js";

export function createStagesAPI(): StagesAPI {
  return {
    init,
    snap,
    list,
    show,
    merge,
    rename,
    commit,
    planDrop,
    drop,
    verify,
    log,
    status,
    listUnstaged,
    readFile,
    readCommitFile,
    getPrevStageId,
    getPrevCommitId,
    readBaselineFile,
    readGitHeadFile,
  };
}

export * from "../types/index.js";
export { StagesError, ERROR_MESSAGES } from "./errors.js";
