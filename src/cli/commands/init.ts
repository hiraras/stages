import { api, getRoot, handleError, success } from "../utils.js";

export async function runInit(): Promise<void> {
  try {
    const result = await api.init(getRoot());
    if (result.alreadyInitialized) {
      console.log("Already initialized.");
      return;
    }

    const status = await api.status(getRoot());
    success(`Initialized stages in ${getRoot()}`);
    console.log(`  Baseline: ${status.baseline.slice(0, 7)}`);
    if (result.gitignoreUpdated) {
      console.log("  Added .stages/ to .gitignore");
    }
    if (result.initialStage) {
      console.log(
        `  Created ${result.initialStage.id} "${result.initialStage.name}" (${result.initialStage.stats.files} files changed vs HEAD)`,
      );
    } else {
      console.log("  No changes vs HEAD, no stage created.");
    }
  } catch (error) {
    handleError(error);
  }
}
