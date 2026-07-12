import { api, getRoot, handleError } from "../utils.js";

export async function runStatus(): Promise<void> {
  try {
    const status = await api.status(getRoot());
    console.log("Stages Status");
    console.log(`  Baseline: ${status.baseline.slice(0, 7)}`);
    console.log(
      `  Total stages: ${status.total} (${status.byStatus.pending} pending, ${status.byStatus.ready} ready, ${status.byStatus.committed} committed)`,
    );
    if (status.latest) {
      console.log(
        `  Latest: ${status.latest.id} "${status.latest.name}" (${status.latest.status}, ${status.latest.createdAt})`,
      );
    }
  } catch (error) {
    handleError(error);
  }
}
