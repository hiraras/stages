import { isCommitRef, resolveStageId } from "../store/id.js";
import { resolveCommit, resolveCumulative, resolveIncremental } from "../diff/resolver.js";
import { getStage, readMeta } from "../store/meta.js";

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
  const stage = getStage(projectRoot, resolvedId);

  if (stage.mergedFrom && stage.mergedFrom.length > 0) {
    return resolveCumulative(projectRoot, resolvedId);
  }

  return resolveIncremental(projectRoot, resolvedId);
}
