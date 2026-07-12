import * as path from "node:path";
import * as vscode from "vscode";
import {
  createStagesAPI,
  type CommitEntry,
  type FileChangeType,
  type StageEntry,
  type UnstagedResult,
} from "stages";
import { buildBaselineUri, buildCommitUri, buildEmptyUri, buildStageUri } from "../fs/stagesFs.js";
import { getShowHiddenSetting } from "../utils/workspace.js";

const api = createStagesAPI();
export const UNSTAGED_GROUP_ID = "__unstaged__";
const HINT_GROUP_ID = "__hint__";
const HINT_SCHEME = "stages-hint";
const HINT_MESSAGE = "Show Files on a group to view changes";

const DECORATION_BY_TYPE: Record<
  FileChangeType,
  { letter: string; color: string }
> = {
  modified: { letter: "M", color: "charts.orange" },
  added: { letter: "A", color: "charts.green" },
  deleted: { letter: "D", color: "charts.red" },
};

interface RefreshSnapshot {
  visibleStages: StageEntry[];
  visibleCommits: CommitEntry[];
  commitPrevIds: Map<string, string | null>;
  unstaged: UnstagedResult;
  previousLabels: Map<string, string>;
}

export class StagesSCMProvider implements vscode.Disposable {
  private readonly scm: vscode.SourceControl;
  private readonly groups = new Map<string, vscode.SourceControlResourceGroup>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly expandedGroups: Set<string>;
  private readonly groupLabels = new Map<string, string>();
  private fileListGeneration = 0;

  constructor(
    private readonly projectRoot: string,
    _context: vscode.ExtensionContext,
  ) {
    this.scm = vscode.scm.createSourceControl("stages", "Stages", workspaceRootUri(projectRoot));
    this.scm.count = 0;
    this.disposables.push(this.scm);
    this.expandedGroups = new Set();
  }

  async refresh(): Promise<void> {
    const snapshot = await this.refreshStructure();
    await this.refreshFileLists(snapshot);
  }

  async refreshStructure(): Promise<RefreshSnapshot> {
    const snapshot = await this.loadSnapshot();
    const previousLabels = new Map(this.groupLabels);
    this.syncGroups(snapshot);
    return { ...snapshot, previousLabels };
  }

  refreshFileLists(snapshot?: RefreshSnapshot): Promise<void> {
    const generation = ++this.fileListGeneration;
    return this.loadFileLists(snapshot, generation);
  }

  async refreshUnstaged(): Promise<void> {
    const unstaged = await api.listUnstaged(this.projectRoot);
    const hadUnstaged = this.groups.has(UNSTAGED_GROUP_ID);
    const hasUnstaged = unstaged.files.length > 0;

    if (!hasUnstaged) {
      if (!hadUnstaged) {
        return;
      }
      const snapshot = await this.loadSnapshot();
      this.syncGroups(snapshot);
      return;
    }

    if (!hadUnstaged) {
      const snapshot = await this.loadSnapshot();
      snapshot.unstaged = unstaged;
      this.syncGroups(snapshot);
      await this.populateUnstagedFiles(unstaged);
      return;
    }

    this.applyUnstagedStructure(unstaged);
    await this.populateUnstagedFiles(unstaged);
  }

  async showFiles(groupId: string): Promise<void> {
    if (groupId === UNSTAGED_GROUP_ID) {
      return;
    }
    this.expandedGroups.add(groupId);
    const snapshot = await this.loadSnapshot();
    const stage = snapshot.visibleStages.find((item) => item.id === groupId);
    if (stage) {
      this.applyStageStructure(stage);
      await this.populateStageFiles(stage);
      return;
    }
    const commit = snapshot.visibleCommits.find((item) => item.id === groupId);
    if (commit) {
      this.applyCommitStructure(commit);
      const prevId = snapshot.commitPrevIds.get(commit.id) ?? null;
      await this.populateCommitFiles(commit, prevId);
    }
    this.syncPanelAnchor(snapshot);
  }

  async hideFiles(groupId: string): Promise<void> {
    if (groupId === UNSTAGED_GROUP_ID) {
      return;
    }
    this.expandedGroups.delete(groupId);
    const group = this.groups.get(groupId);
    if (group) {
      group.resourceStates = [];
      this.setGroupContext(group, groupId);
    }
    void this.syncPanelAnchor(await this.loadSnapshot());
  }

  dispose(): void {
    for (const group of this.groups.values()) {
      group.dispose();
    }
    this.groups.clear();
    this.groupLabels.clear();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private async loadSnapshot(): Promise<RefreshSnapshot> {
    const showHidden = getShowHiddenSetting();
    const [current, unstaged] = await Promise.all([
      api.list(this.projectRoot),
      api.listUnstaged(this.projectRoot),
    ]);

    const visibleStages = sortNewestFirst(
      showHidden
        ? [
            ...current,
            ...(await api.list(this.projectRoot, { all: true })).filter(
              (stage) =>
                stage.status === "committed" &&
                stage.hidden &&
                !current.some((item) => item.id === stage.id),
            ),
          ]
        : current,
    );

    const visibleCommits = [...(await api.log(this.projectRoot))].reverse();
    const commitPrevIds = new Map<string, string | null>();
    for (let index = 0; index < visibleCommits.length; index += 1) {
      const commit = visibleCommits[index]!;
      commitPrevIds.set(commit.id, index < visibleCommits.length - 1 ? visibleCommits[index + 1]!.id : null);
    }

    return { visibleStages, visibleCommits, commitPrevIds, unstaged, previousLabels: new Map() };
  }

  private async loadFileLists(snapshot: RefreshSnapshot | undefined, generation: number): Promise<void> {
    const data = snapshot ?? (await this.loadSnapshot());
    const previousLabels = snapshot?.previousLabels ?? new Map(this.groupLabels);
    const tasks: Array<Promise<void>> = [];

    if (data.unstaged.files.length > 0) {
      tasks.push(this.populateUnstagedFiles(data.unstaged));
    }

    for (const stage of data.visibleStages) {
      const label = this.formatStageLabel(stage);
      if (this.shouldRefreshFiles(stage.id, label, previousLabels)) {
        tasks.push(this.populateStageFiles(stage));
      }
    }

    for (const commit of data.visibleCommits) {
      const label = this.formatCommitLabel(commit);
      if (this.shouldRefreshFiles(commit.id, label, previousLabels)) {
        const prevId = data.commitPrevIds.get(commit.id) ?? null;
        tasks.push(this.populateCommitFiles(commit, prevId));
      }
    }

    await Promise.all(tasks);
    if (generation !== this.fileListGeneration) {
      return;
    }
  }

  private syncGroups(snapshot: RefreshSnapshot): void {
    const desiredIds = this.getDesiredGroupOrder(snapshot);
    const activeIds = new Set(desiredIds);

    for (const id of [...this.expandedGroups]) {
      if (!activeIds.has(id)) {
        this.expandedGroups.delete(id);
      }
    }

    for (const [id, group] of [...this.groups]) {
      if (!activeIds.has(id)) {
        group.dispose();
        this.groups.delete(id);
        this.groupLabels.delete(id);
      }
    }

    const currentIds = [...this.groups.keys()];
    const needsReorder =
      currentIds.length !== desiredIds.length ||
      currentIds.some((id, index) => id !== desiredIds[index]);

    if (needsReorder) {
      for (const group of this.groups.values()) {
        group.dispose();
      }
      this.groups.clear();
      this.groupLabels.clear();
      this.populateAllGroups(snapshot);
      return;
    }

    if (snapshot.unstaged.files.length > 0) {
      this.applyUnstagedStructure(snapshot.unstaged);
    }

    for (const stage of snapshot.visibleStages) {
      this.applyStageStructure(stage);
    }

    for (const commit of snapshot.visibleCommits) {
      this.applyCommitStructure(commit);
    }

    this.syncPanelAnchor(snapshot);
  }

  private populateAllGroups(snapshot: RefreshSnapshot): void {
    if (snapshot.unstaged.files.length > 0) {
      this.applyUnstagedStructure(snapshot.unstaged);
    }

    for (const stage of snapshot.visibleStages) {
      this.applyStageStructure(stage);
    }

    for (const commit of snapshot.visibleCommits) {
      this.applyCommitStructure(commit);
    }

    this.syncPanelAnchor(snapshot);
  }

  private getDesiredGroupOrder(snapshot: RefreshSnapshot): string[] {
    const order: string[] = [];
    if (snapshot.unstaged.files.length > 0) {
      order.push(UNSTAGED_GROUP_ID);
    }
    for (const stage of snapshot.visibleStages) {
      order.push(stage.id);
    }
    for (const commit of snapshot.visibleCommits) {
      order.push(commit.id);
    }
    if (this.needsPanelAnchor(snapshot)) {
      order.push(HINT_GROUP_ID);
    }
    return order;
  }

  private needsPanelAnchor(snapshot: RefreshSnapshot): boolean {
    if (snapshot.unstaged.files.length > 0) {
      return false;
    }
    if (this.expandedGroups.size > 0) {
      return false;
    }
    return snapshot.visibleStages.length > 0 || snapshot.visibleCommits.length > 0;
  }

  private syncPanelAnchor(snapshot: RefreshSnapshot): void {
    if (this.needsPanelAnchor(snapshot)) {
      this.applyHintStructure();
      return;
    }
    this.removeHintGroup();
  }

  private applyHintStructure(): void {
    let group = this.groups.get(HINT_GROUP_ID);
    if (!group) {
      group = this.scm.createResourceGroup(HINT_GROUP_ID, HINT_MESSAGE);
      this.configureGroup(group);
      this.groups.set(HINT_GROUP_ID, group);
    } else if (group.label !== HINT_MESSAGE) {
      group.label = HINT_MESSAGE;
    }

    this.configureGroup(group);
    group.contextValue = "hint";
    group.resourceStates = [this.buildHintResource()];
    this.groupLabels.set(HINT_GROUP_ID, HINT_MESSAGE);
  }

  private removeHintGroup(): void {
    const group = this.groups.get(HINT_GROUP_ID);
    group?.dispose();
    this.groups.delete(HINT_GROUP_ID);
    this.groupLabels.delete(HINT_GROUP_ID);
  }

  private buildHintResource(): vscode.SourceControlResourceState {
    return {
      resourceUri: vscode.Uri.from({ scheme: HINT_SCHEME, path: "/\u200b" }),
      decorations: {
        faded: true,
        tooltip: HINT_MESSAGE,
      },
    } satisfies vscode.SourceControlResourceState;
  }

  private shouldShowFiles(groupId: string): boolean {
    if (groupId === UNSTAGED_GROUP_ID) {
      return true;
    }
    return this.expandedGroups.has(groupId);
  }

  private shouldRefreshFiles(
    groupId: string,
    label: string,
    previousLabels: Map<string, string>,
  ): boolean {
    if (!this.shouldShowFiles(groupId)) {
      return false;
    }

    if (groupId === UNSTAGED_GROUP_ID) {
      return true;
    }

    const group = this.groups.get(groupId);
    if (!group || group.resourceStates.length === 0) {
      return true;
    }

    if (!previousLabels.has(groupId)) {
      return true;
    }

    return previousLabels.get(groupId) !== label;
  }

  private setGroupContext(group: vscode.SourceControlResourceGroup, groupId: string): void {
    if (groupId === HINT_GROUP_ID) {
      group.contextValue = "hint";
      return;
    }
    if (groupId === UNSTAGED_GROUP_ID) {
      group.contextValue = "files-visible-unstaged";
      return;
    }
    if (!this.shouldShowFiles(groupId)) {
      group.contextValue = "files-hidden";
      return;
    }
    group.contextValue = "files-visible";
  }

  private configureGroup(group: vscode.SourceControlResourceGroup): void {
    group.hideWhenEmpty = false;
  }

  private applyUnstagedStructure(unstaged: UnstagedResult): void {
    const label = this.formatUnstagedLabel(unstaged.files.length);
    let group = this.groups.get(UNSTAGED_GROUP_ID);
    if (!group) {
      group = this.scm.createResourceGroup(UNSTAGED_GROUP_ID, label);
      this.configureGroup(group);
      this.groups.set(UNSTAGED_GROUP_ID, group);
    } else if (group.label !== label) {
      group.label = label;
    }

    this.configureGroup(group);
    this.setGroupContext(group, UNSTAGED_GROUP_ID);
    this.groupLabels.set(UNSTAGED_GROUP_ID, label);
  }

  private applyStageStructure(stage: StageEntry): void {
    const label = this.formatStageLabel(stage);
    let group = this.groups.get(stage.id);
    if (!group) {
      group = this.scm.createResourceGroup(stage.id, label);
      this.configureGroup(group);
      this.groups.set(stage.id, group);
    } else if (group.label !== label) {
      group.label = label;
    }

    this.configureGroup(group);
    this.setGroupContext(group, stage.id);
    this.groupLabels.set(stage.id, label);

    if (!this.shouldShowFiles(stage.id)) {
      group.resourceStates = [];
    }
  }

  private applyCommitStructure(commit: CommitEntry): void {
    const label = this.formatCommitLabel(commit);
    let group = this.groups.get(commit.id);
    if (!group) {
      group = this.scm.createResourceGroup(commit.id, label);
      this.configureGroup(group);
      this.groups.set(commit.id, group);
    } else if (group.label !== label) {
      group.label = label;
    }

    this.configureGroup(group);
    this.setGroupContext(group, commit.id);
    this.groupLabels.set(commit.id, label);

    if (!this.shouldShowFiles(commit.id)) {
      group.resourceStates = [];
    }
  }

  private async populateUnstagedFiles(unstaged: UnstagedResult): Promise<void> {
    const group = this.groups.get(UNSTAGED_GROUP_ID);
    if (!group) {
      return;
    }

    const referenceStageId = unstaged.referenceStageId;
    group.resourceStates = unstaged.files.map((file) =>
      this.buildUnstagedResourceState(file, referenceStageId),
    );
  }

  private buildUnstagedResourceState(
    file: { path: string; type: FileChangeType },
    referenceStageId: string | null,
  ): vscode.SourceControlResourceState {
    const decoration = DECORATION_BY_TYPE[file.type];
    const leftUri =
      file.type === "added"
        ? buildEmptyUri(file.path)
        : referenceStageId
          ? buildStageUri(referenceStageId, file.path)
          : buildBaselineUri(file.path);
    const rightUri =
      file.type === "deleted"
        ? buildEmptyUri(file.path)
        : buildWorkspaceUri(this.projectRoot, file.path);

    return {
      resourceUri: rightUri,
      decorations: {
        strikeThrough: file.type === "deleted",
        tooltip: `${decoration.letter} ${file.path}`,
      },
      command: {
        command: "stages.openDiff",
        title: "Open Diff",
        arguments: [
          UNSTAGED_GROUP_ID,
          "Unstaged",
          file.path,
          file.type,
          leftUri.toString(),
          rightUri.toString(),
        ],
      },
    } satisfies vscode.SourceControlResourceState;
  }

  private async populateStageFiles(stage: StageEntry): Promise<void> {
    const group = this.groups.get(stage.id);
    if (!group || !this.shouldShowFiles(stage.id)) {
      return;
    }

    const diff = api.show(this.projectRoot, stage.id);
    const prevId = stage.prev;
    const useBaseline = prevId === null || Boolean(stage.mergedFrom?.length);

    group.resourceStates = diff.files.map((file) =>
      this.buildResourceState({
        id: stage.id,
        name: stage.name,
        file,
        leftUri:
          file.type === "added"
            ? buildEmptyUri(file.path)
            : useBaseline
              ? buildBaselineUri(file.path)
              : buildStageUri(prevId!, file.path),
        rightUri:
          file.type === "deleted"
            ? buildEmptyUri(file.path)
            : buildStageUri(stage.id, file.path),
        faded: stage.hidden,
      }),
    );
  }

  private async populateCommitFiles(commit: CommitEntry, prevId: string | null): Promise<void> {
    const group = this.groups.get(commit.id);
    if (!group || !this.shouldShowFiles(commit.id)) {
      return;
    }

    const diff = api.show(this.projectRoot, commit.id);
    const useBaseline = prevId === null;

    group.resourceStates = diff.files.map((file) =>
      this.buildResourceState({
        id: commit.id,
        name: commit.name,
        file,
        leftUri:
          file.type === "added"
            ? buildEmptyUri(file.path)
            : useBaseline
              ? buildBaselineUri(file.path)
              : buildCommitUri(prevId!, file.path),
        rightUri:
          file.type === "deleted"
            ? buildEmptyUri(file.path)
            : buildCommitUri(commit.id, file.path),
      }),
    );
  }

  private buildResourceState(input: {
    id: string;
    name: string;
    file: { path: string; type: FileChangeType };
    leftUri: vscode.Uri;
    rightUri: vscode.Uri;
    faded?: boolean;
  }): vscode.SourceControlResourceState {
    const decoration = DECORATION_BY_TYPE[input.file.type];

    return {
      resourceUri: input.rightUri,
      decorations: {
        strikeThrough: input.file.type === "deleted",
        faded: input.faded,
        tooltip: `${decoration.letter} ${input.file.path}`,
      },
      command: {
        command: "stages.openDiff",
        title: "Open Diff",
        arguments: [
          input.id,
          input.name,
          input.file.path,
          input.file.type,
          input.leftUri.toString(),
          input.rightUri.toString(),
        ],
      },
    } satisfies vscode.SourceControlResourceState;
  }

  private formatUnstagedLabel(fileCount: number): string {
    return `Unstaged Changes [${fileCount}]`;
  }

  private formatStageLabel(stage: StageEntry): string {
    const merged =
      stage.mergedFrom && stage.mergedFrom.length > 0
        ? ` (merged ${stage.mergedFrom.map((id) => id.replace("stage-", "")).join("+")})`
        : "";
    const hidden = stage.hidden ? " [hidden]" : "";
    return `${stage.id.replace("stage-", "")} ${stage.name} [${stage.status}]${merged}${hidden}`;
  }

  private formatCommitLabel(commit: CommitEntry): string {
    return `${commit.id.replace("commit-", "")} ${commit.name} [commit]`;
  }
}

function sortNewestFirst(stages: StageEntry[]): StageEntry[] {
  return [...stages].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function buildWorkspaceUri(projectRoot: string, filePath: string): vscode.Uri {
  return vscode.Uri.file(path.join(projectRoot, filePath));
}

function workspaceRootUri(projectRoot: string): vscode.Uri {
  return vscode.Uri.file(projectRoot);
}

export async function openStageDiff(
  _stageId: string,
  stageName: string,
  filePath: string,
  changeType: FileChangeType,
  leftUriString: string,
  rightUriString: string,
): Promise<void> {
  const leftUri = vscode.Uri.parse(leftUriString);
  const rightUri = vscode.Uri.parse(rightUriString);
  const title = `${stageName}: ${filePath} (${changeType})`;
  await vscode.commands.executeCommand("vscode.diff", leftUri, rightUri, title);
}
