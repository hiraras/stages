import * as vscode from "vscode";
import { createStagesAPI, StagesError } from "@hiraras/stages";

const api = createStagesAPI();

export async function renameStage(
  projectRoot: string,
  stageId: string,
  currentName: string,
  refresh: () => Promise<void>,
): Promise<void> {
  const newName = await vscode.window.showInputBox({
    title: "Rename Stage",
    value: currentName,
    prompt: "Enter a new name for this stage",
    validateInput: (value) => (value.trim() ? null : "Name cannot be empty"),
  });

  if (!newName || newName.trim() === currentName) {
    return;
  }

  try {
    await api.rename(projectRoot, stageId, newName.trim());
    await refresh();
    void vscode.window.showInformationMessage(`Renamed stage to "${newName.trim()}"`);
  } catch (error) {
    if (error instanceof StagesError) {
      void vscode.window.showErrorMessage(error.message);
      return;
    }
    throw error;
  }
}

export async function pickStageForRename(
  projectRoot: string,
  refresh: () => Promise<void>,
): Promise<void> {
  const stages = await api.list(projectRoot);
  const candidates = stages.filter(
    (stage) => stage.status === "pending" || stage.status === "ready",
  );

  if (candidates.length === 0) {
    void vscode.window.showWarningMessage("No renamable stages in the current cycle.");
    return;
  }

  const picked = await vscode.window.showQuickPick(
    candidates.map((stage) => ({
      label: `${stage.id} — ${stage.name}`,
      description: stage.status,
      stageId: stage.id,
      stageName: stage.name,
    })),
    { title: "Select stage to rename" },
  );

  if (!picked) {
    return;
  }

  await renameStage(projectRoot, picked.stageId, picked.stageName, refresh);
}
