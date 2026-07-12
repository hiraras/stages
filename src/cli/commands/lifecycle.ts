import { api, getRoot, handleError, success } from "../utils.js";

export async function runRename(stageId: string, newName: string): Promise<void> {
  try {
    await api.rename(getRoot(), stageId, newName);
    success(`Renamed ${stageId} to "${newName}"`);
  } catch (error) {
    handleError(error);
  }
}

export async function runHide(stageId: string): Promise<void> {
  try {
    await api.hide(getRoot(), stageId);
    success(`Hidden ${stageId}`);
  } catch (error) {
    handleError(error);
  }
}

export async function runUnhide(stageId: string): Promise<void> {
  try {
    await api.unhide(getRoot(), stageId);
    success(`Unhidden ${stageId}`);
  } catch (error) {
    handleError(error);
  }
}
