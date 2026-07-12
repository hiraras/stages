import { StagesError } from "../../core/errors.js";
import { detectDirtyFiles } from "../../core/git/dirty.js";
import { readManifest } from "../../core/store/manifest.js";
import { getLatestActiveStage, readMeta } from "../../core/store/meta.js";
import { api, getRoot, handleError, success, warn } from "../utils.js";

export async function runCommit(message: string | undefined, force = false): Promise<void> {
  try {
    const root = getRoot();

    if (!message?.trim()) {
      console.error("✗ Error: -m is required for commit.");
      process.exit(1);
    }

    if (!force) {
      const meta = readMeta(root);
      const latest = getLatestActiveStage(meta);
      if (latest) {
        const latestManifest = readManifest(root, latest.id);
        const dirty = await detectDirtyFiles(root, latestManifest);
        if (dirty.length > 0) {
          warn("Working tree has unstaged changes:");
          for (const file of dirty) {
            console.log(`  ${file.reason === "added" ? "A" : file.reason === "deleted" ? "D" : "M"}  ${file.path}`);
          }
          console.log("");
          console.log(
            "  These changes are not part of any stage and may be overwritten.",
          );
          console.log("  Use --force to proceed anyway.");
          process.exit(1);
        }
      }
    }

    const entry = await api.commit(root, { message, force });
    success(`Created ${entry.id} "${entry.name}"`);
    console.log(
      `  ${entry.stats.files} files (+${entry.stats.additions}, -${entry.stats.deletions}) from ${entry.stageIds.length} stage(s)`,
    );
    console.log("  Applied to working tree. Run `git add` and `git commit` next.");
  } catch (error) {
    if (error instanceof StagesError && error.code === "DIRTY_WORKTREE") {
      warn(error.message);
      process.exit(1);
    }
    handleError(error);
  }
}
