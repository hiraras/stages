import * as path from "node:path";
import * as vscode from "vscode";
import { registerStagesContentProvider } from "./fs/stagesFs.js";
import { openStageDiff, StagesSCMProvider } from "./scm/stagesProvider.js";
import { pickStageForRename } from "./commands/rename.js";
import { dropStage } from "./commands/drop.js";
import { findStagesRoot } from "./utils/workspace.js";

let scmProvider: StagesSCMProvider | null = null;
let watcher: vscode.FileSystemWatcher | null = null;
let refreshChain: Promise<void> = Promise.resolve();
let refreshQueued = false;
let workspaceRefreshTimer: ReturnType<typeof setTimeout> | undefined;

function isProjectFile(projectRoot: string, uri: vscode.Uri): boolean {
  if (uri.scheme !== "file") {
    return false;
  }
  const relative = path.relative(projectRoot, uri.fsPath);
  return relative.length > 0 && !relative.startsWith("..") && !relative.startsWith(".stages");
}

function scheduleRefresh(
  contentProvider: ReturnType<typeof registerStagesContentProvider>["provider"],
  mode: "full" | "fast",
): Promise<void> {
  contentProvider.refresh();
  refreshQueued = true;
  refreshChain = refreshChain.then(async () => {
    if (!refreshQueued || !scmProvider) {
      return;
    }
    refreshQueued = false;
    let effectiveMode = mode;
    do {
      refreshQueued = false;
      if (effectiveMode === "fast") {
        await scmProvider.refreshUnstaged();
        if (refreshQueued) {
          effectiveMode = "full";
        }
        continue;
      }
      const snapshot = await scmProvider.refreshStructure();
      await scmProvider.refreshFileLists(snapshot);
      effectiveMode = "full";
    } while (refreshQueued);
  });
  return refreshChain;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const projectRoot = findStagesRoot();
  if (!projectRoot) {
    return;
  }

  const { provider: contentProvider, disposable: contentDisposable } =
    registerStagesContentProvider(projectRoot);
  context.subscriptions.push(contentDisposable);

  scmProvider = new StagesSCMProvider(projectRoot, context);
  context.subscriptions.push(scmProvider);
  await scmProvider.refresh();

  const refresh = (mode: "full" | "fast" = "full") =>
    scheduleRefresh(contentProvider, mode);

  watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(projectRoot, ".stages/meta.json"),
  );
  watcher.onDidChange(() => {
    void refresh("full");
  });
  watcher.onDidCreate(() => {
    void refresh("full");
  });
  context.subscriptions.push(watcher);

  const scheduleWorkspaceRefresh = () => {
    if (workspaceRefreshTimer) {
      clearTimeout(workspaceRefreshTimer);
    }
    workspaceRefreshTimer = setTimeout(() => {
      workspaceRefreshTimer = undefined;
      void refresh("fast");
    }, 400);
  };

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isProjectFile(projectRoot, document.uri)) {
        scheduleWorkspaceRefresh();
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (isProjectFile(projectRoot, event.document.uri)) {
        scheduleWorkspaceRefresh();
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidCreateFiles((event) => {
      if (event.files.some((uri) => isProjectFile(projectRoot, uri))) {
        scheduleWorkspaceRefresh();
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidDeleteFiles((event) => {
      if (event.files.some((uri) => isProjectFile(projectRoot, uri))) {
        scheduleWorkspaceRefresh();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("stages.refresh", () => refresh("full")),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("stages.rename", async (group?: { id: string; label: string }) => {
      if (!scmProvider) {
        return;
      }
      if (group?.id?.startsWith("stage-")) {
        const nameMatch = /^\S+\s+(.+?)\s+\[/.exec(group.label);
        const currentName = nameMatch?.[1] ?? group.label;
        const { renameStage } = await import("./commands/rename.js");
        await renameStage(projectRoot, group.id, currentName, () => refresh("full"));
        return;
      }
      await pickStageForRename(projectRoot, () => refresh("full"));
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("stages.showFiles", async (group?: { id: string }) => {
      if (!scmProvider || !group?.id) {
        return;
      }
      await scmProvider.showFiles(group.id);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("stages.hideFiles", async (group?: { id: string }) => {
      if (!scmProvider || !group?.id) {
        return;
      }
      await scmProvider.hideFiles(group.id);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("stages.drop", async (group?: { id: string }) => {
      if (!scmProvider || !group?.id?.startsWith("stage-")) {
        return;
      }
      await dropStage(projectRoot, group.id, () => refresh("full"));
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("stages.openDiff",
      (
        stageId: string,
        stageName: string,
        filePath: string,
        changeType: string,
        leftUri: string,
        rightUri: string,
      ) => openStageDiff(stageId, stageName, filePath, changeType as "added" | "modified" | "deleted", leftUri, rightUri),
    ),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("stages.showHidden")) {
        void refresh("full");
      }
    }),
  );
}

export function deactivate(): void {
  scmProvider?.dispose();
  scmProvider = null;
  watcher?.dispose();
  watcher = null;
}
