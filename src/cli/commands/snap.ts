import { StagesError } from "../../core/errors.js";
import { api, getRoot, handleError, success } from "../utils.js";

export async function runSnap(message?: string): Promise<void> {
  try {
    const entry = await api.snap(getRoot(), { message });
    success(`Created ${entry.id} "${entry.name}"`);
    console.log(
      `  ${entry.stats.files} files changed (+${entry.stats.additions}, -${entry.stats.deletions})`,
    );
  } catch (error) {
    if (error instanceof StagesError && error.code === "SNAP_NO_CHANGES") {
      console.log("No new changes.");
      return;
    }
    handleError(error);
  }
}
