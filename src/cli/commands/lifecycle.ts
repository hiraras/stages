import { api, getRoot, handleError, success } from "../utils.js";

export async function runRename(stageId: string, newName: string): Promise<void> {
  try {
    await api.rename(getRoot(), stageId, newName);
    success(`Renamed ${stageId} to "${newName}"`);
  } catch (error) {
    handleError(error);
  }
}

