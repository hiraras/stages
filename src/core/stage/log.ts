import type { CommitEntry } from "../../types/index.js";
import { readMeta, listCommits } from "../store/meta.js";

export async function log(projectRoot: string): Promise<CommitEntry[]> {
  const meta = readMeta(projectRoot);
  // Newest first (matches stages list / SCM).
  return listCommits(meta).slice().reverse();
}
