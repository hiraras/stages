import { api, getRoot, handleError } from "../utils.js";

function formatDate(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function runLog(): Promise<void> {
  try {
    const commits = await api.log(getRoot());
    if (commits.length === 0) {
      console.log("No commits found.");
      return;
    }

    console.log("ID          名称              时间                 变更              Stages");
    for (const commit of commits) {
      const line = [
        commit.id.padEnd(11),
        commit.name.slice(0, 16).padEnd(16),
        formatDate(commit.createdAt).padEnd(19),
        `${commit.stats.files} files (+${commit.stats.additions}/-${commit.stats.deletions})`.padEnd(17),
        commit.stageIds.map((id) => id.replace("stage-", "")).join(","),
      ].join(" ");
      console.log(line);
    }
  } catch (error) {
    handleError(error);
  }
}
