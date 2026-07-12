import * as vscode from "vscode";
import type { DropPlan } from "stages";
import { createStagesAPI, StagesError } from "stages";

const api = createStagesAPI();

function formatRestoreTarget(plan: DropPlan): string {
  if (plan.restoreTarget.kind === "stage") {
    return `${plan.restoreTarget.stageId}「${plan.restoreTarget.stageName}」`;
  }
  return "cycle baseline";
}

function buildConfirmMessage(plan: DropPlan): string {
  const lines = [
    `Delete ${plan.droppedStages.length} stage(s):`,
    ...plan.droppedStages.map((stage) => `• ${stage.id} — ${stage.name}`),
    "",
    `Restore worktree to ${formatRestoreTarget(plan)}.`,
    `${plan.affectedFiles.length} file(s) will be changed.`,
  ];
  return lines.join("\n");
}

export async function dropStage(
  projectRoot: string,
  stageId: string,
  refresh: () => Promise<void>,
): Promise<void> {
  let plan: DropPlan;
  try {
    plan = api.planDrop(projectRoot, stageId);
  } catch (error) {
    if (error instanceof StagesError) {
      void vscode.window.showErrorMessage(error.message);
      return;
    }
    throw error;
  }

  const confirm = await vscode.window.showWarningMessage(
    buildConfirmMessage(plan),
    { modal: true },
    "Drop",
  );

  if (confirm !== "Drop") {
    return;
  }

  try {
    const result = await api.drop(projectRoot, stageId);
    await refresh();
    const restoreLabel =
      result.restoreTarget.kind === "stage"
        ? result.restoreTarget.stageId
        : "baseline";
    void vscode.window.showInformationMessage(
      `Dropped ${result.droppedIds.length} stage(s). Worktree restored to ${restoreLabel}.`,
    );
  } catch (error) {
    if (error instanceof StagesError) {
      if (error.code === "DIRTY_WORKTREE") {
        void vscode.window.showErrorMessage(
          `${error.message} Save with stages -m or use stages drop --force in the terminal.`,
        );
        return;
      }
      void vscode.window.showErrorMessage(error.message);
      return;
    }
    throw error;
  }
}
