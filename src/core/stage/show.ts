import { isCommitRef, resolveStageId } from "../store/id.js";
import { resolveCommit, resolveIncremental } from "../diff/resolver.js";
import { readMeta } from "../store/meta.js";

export function show(
  projectRoot: string,
  id: string,
  _opts?: { stat?: boolean },
) {
  if (isCommitRef(id)) {
    return resolveCommit(projectRoot, id);
  }

  const meta = readMeta(projectRoot);
  const resolvedId = resolveStageId(meta, id);
  return resolveIncremental(projectRoot, resolvedId);
}
