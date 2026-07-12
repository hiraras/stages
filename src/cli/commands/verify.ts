import {
  formatDirtyFiles,
  formatUncommittedStages,
} from "../../core/stage/verify.js";
import { api, getRoot, handleError, success } from "../utils.js";

export async function runVerify(): Promise<void> {
  try {
    const result = await api.verify(getRoot());

    if (result.status === "skipped") {
      if (result.reason === "not_initialized") {
        console.log("Stages not initialized, skipping verify.");
        return;
      }
      console.log("No stages found, skipping verify.");
      return;
    }

    if (result.status === "failed") {
      if (result.reason === "uncommitted_stages" && result.uncommittedStages) {
        console.error("✗ Uncommitted stages:");
        for (const line of formatUncommittedStages(result.uncommittedStages)) {
          console.error(`  ${line}`);
        }
        console.error("  Run `stages commit -m \"message\"` to apply and archive stages.");
        process.exit(1);
      }

      if (result.reason === "dirty_worktree" && result.dirtyFiles) {
        console.error("✗ Working tree has unstaged changes:");
        for (const line of formatDirtyFiles(result.dirtyFiles)) {
          console.error(`  ${line}`);
        }
        console.error("  Run `stages` to save changes before building.");
        process.exit(1);
      }

      console.error("✗ Verify failed.");
      process.exit(1);
    }

    success("All stages committed, working tree clean.");
  } catch (error) {
    handleError(error);
  }
}
