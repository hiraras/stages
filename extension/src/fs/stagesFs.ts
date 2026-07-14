import * as vscode from "vscode";
import { createStagesAPI } from "@hiraras/stages";

const BASELINE_AUTHORITY = "baseline";
const GIT_HEAD_AUTHORITY = "git-head";
const EMPTY_AUTHORITY = "__empty__";
const api = createStagesAPI();

export class StagesContentProvider implements vscode.TextDocumentContentProvider {
  private readonly changeEmitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.changeEmitter.event;

  constructor(private readonly projectRoot: string) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const filePath = uri.path.replace(/^\//, "");
    if (!filePath) {
      return "";
    }

    let content: Buffer | null = null;
    if (uri.authority === BASELINE_AUTHORITY) {
      content = await api.readBaselineFile(this.projectRoot, filePath);
    } else if (uri.authority === GIT_HEAD_AUTHORITY) {
      content = await api.readGitHeadFile(this.projectRoot, filePath);
    } else if (uri.authority === EMPTY_AUTHORITY) {
      return "";
    } else if (uri.authority.startsWith("commit-")) {
      content = await api.readCommitFile(this.projectRoot, uri.authority, filePath);
    } else if (uri.authority) {
      content = await api.readFile(this.projectRoot, uri.authority, filePath);
    }

    return content?.toString("utf8") ?? "";
  }

  refresh(): void {
    for (const doc of vscode.workspace.textDocuments) {
      if (doc.uri.scheme === "stages") {
        this.changeEmitter.fire(doc.uri);
      }
    }
  }
}

export function buildStageUri(stageId: string, filePath: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: "stages",
    authority: stageId,
    path: `/${filePath}`,
  });
}

export function buildCommitUri(commitId: string, filePath: string): vscode.Uri {
  return buildStageUri(commitId, filePath);
}

export function buildEmptyUri(filePath: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: "stages",
    authority: EMPTY_AUTHORITY,
    path: `/${filePath}`,
  });
}

export function buildBaselineUri(filePath: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: "stages",
    authority: BASELINE_AUTHORITY,
    path: `/${filePath}`,
  });
}

/** Initial git HEAD (`meta.baseline`) — used as left pane for the oldest stages commit. */
export function buildGitHeadUri(filePath: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: "stages",
    authority: GIT_HEAD_AUTHORITY,
    path: `/${filePath}`,
  });
}

export function registerStagesContentProvider(
  projectRoot: string,
): { provider: StagesContentProvider; disposable: vscode.Disposable } {
  const provider = new StagesContentProvider(projectRoot);
  const disposable = vscode.workspace.registerTextDocumentContentProvider(
    "stages",
    provider,
  );
  return { provider, disposable };
}
