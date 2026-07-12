import { api, getRoot, handleError } from "../utils.js";

function formatDate(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function runList(all = false): Promise<void> {
  try {
    const stages = await api.list(getRoot(), { all });
    if (stages.length === 0) {
      console.log("No stages found.");
      return;
    }

    console.log("ID         名称              状态       时间                 变更");
    for (const stage of stages) {
      const line = [
        stage.id.padEnd(10),
        stage.name.slice(0, 16).padEnd(16),
        stage.status.padEnd(10),
        formatDate(stage.createdAt).padEnd(19),
        `${stage.stats.files} files (+${stage.stats.additions}/-${stage.stats.deletions})`,
      ].join(" ");
      console.log(line);
    }
  } catch (error) {
    handleError(error);
  }
}
