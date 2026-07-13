import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { DropPlan } from "../../types/index.js";
import { StagesError } from "../../core/errors.js";
import { detectDropDirtyFiles } from "../../core/stage/drop.js";
import { api, getRoot, handleError, success, warn } from "../utils.js";

async function confirmDrop(): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question("确认删除？[y/N] ");
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

function formatRestoreTarget(plan: DropPlan): string {
  if (plan.restoreTarget.kind === "stage") {
    return `${plan.restoreTarget.stageId}「${plan.restoreTarget.stageName}」`;
  }
  return "cycle baseline";
}

function printDropPreview(plan: DropPlan): void {
  console.log(`即将删除以下 stage（${plan.droppedStages.length} 个）：`);
  for (const stage of plan.droppedStages) {
    console.log(`  ${stage.id}  ${stage.name}`);
  }
  console.log("");
  console.log(`工作区将恢复到 ${formatRestoreTarget(plan)} 的快照。`);
  console.log(
    `约 ${plan.affectedFiles.length} 个文件会被修改/删除/还原。`,
  );
  console.log("");
}

export async function runDrop(
  stageId: string,
  yes = false,
  force = false,
): Promise<void> {
  try {
    const root = getRoot();
    const plan = api.planDrop(root, stageId);

    if (!force) {
      const dirty = await detectDropDirtyFiles(root);
      if (dirty.length > 0) {
        warn("Working tree has unstaged changes:");
        for (const file of dirty) {
          console.log(
            `  ${file.reason === "added" ? "A" : file.reason === "deleted" ? "D" : "M"}  ${file.path}`,
          );
        }
        console.log("");
        console.log(
          "  These changes are not part of any stage and may be overwritten.",
        );
        console.log("  Use --force to proceed anyway.");
        process.exit(1);
      }
    }

    printDropPreview(plan);

    if (!yes) {
      const confirmed = await confirmDrop();
      if (!confirmed) {
        console.log("Cancelled.");
        return;
      }
    }

    const result = await api.drop(root, stageId, { force });
    success(`Dropped ${result.droppedIds.join(", ")}`);

    if (result.restoreTarget.kind === "stage") {
      console.log(`  Worktree restored to ${result.restoreTarget.stageId}`);
    } else {
      console.log("  Worktree restored to baseline");
    }
  } catch (error) {
    if (error instanceof StagesError && error.code === "DIRTY_WORKTREE") {
      warn(error.message);
      process.exit(1);
    }
    handleError(error);
  }
}
