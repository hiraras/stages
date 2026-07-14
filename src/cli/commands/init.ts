import { api, getRoot, handleError, success } from "../utils.js";

export async function runInit(message?: string): Promise<void> {
  try {
    const result = await api.init(getRoot(), { message });
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
    if (result.initialCommit) {
      const { id, name, stats } = result.initialCommit;
      console.log(
        `  Created ${id} "${name}" (${stats.files} files changed vs HEAD)`,
      );
    }
  } catch (error) {
    handleError(error);
  }
}
