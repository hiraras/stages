import { api, getRoot, handleError, success } from "../utils.js";

export async function runMerge(ids: string[], name?: string): Promise<void> {
  try {
    if (!name) {
      console.error("✗ Error: --name is required for merge.");
      process.exit(1);
    }

    const entry = await api.merge(getRoot(), ids, name);
    const absorbedIds =
      entry.mergedFrom?.filter((id) => id !== entry.id).join(", ") ?? "";
    success(`Merged ${absorbedIds} into ${entry.id} "${entry.name}"`);
    console.log(
      `  ${entry.stats.files} files (+${entry.stats.additions}, -${entry.stats.deletions})`,
    );
  } catch (error) {
    handleError(error);
  }
}
