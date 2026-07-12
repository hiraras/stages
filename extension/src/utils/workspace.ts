import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";

export function findStagesRoot(): string | null {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return null;
  }

  for (const folder of folders) {
    const metaPath = path.join(folder.uri.fsPath, ".stages", "meta.json");
    if (fs.existsSync(metaPath)) {
      return folder.uri.fsPath;
    }
  }

  return null;
}

export function getShowHiddenSetting(): boolean {
  return vscode.workspace.getConfiguration("stages").get<boolean>("showHidden", false);
}
