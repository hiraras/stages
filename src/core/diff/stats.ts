export function computeStats(diffOutput: string): {
  additions: number;
  deletions: number;
} {
  let additions = 0;
  let deletions = 0;

  for (const line of diffOutput.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    if (line.startsWith("+")) {
      additions += 1;
    } else if (line.startsWith("-")) {
      deletions += 1;
    }
  }

  return { additions, deletions };
}

export function aggregateStats(
  statsList: Array<{ additions: number; deletions: number; files?: number }>,
): { files: number; additions: number; deletions: number } {
  return statsList.reduce<{ files: number; additions: number; deletions: number }>(
    (total, current) => ({
      files: total.files + (current.files ?? 0),
      additions: total.additions + current.additions,
      deletions: total.deletions + current.deletions,
    }),
    { files: 0, additions: 0, deletions: 0 },
  );
}
