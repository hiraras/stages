import type { StageEntry, StagesMeta } from "../../types/index.js";
import { StagesError } from "../errors.js";

export function normalizeStageInput(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("stage-")) {
    return trimmed;
  }

  const sequence = Number.parseInt(trimmed, 10);
  if (Number.isNaN(sequence)) {
    throw new StagesError("STAGE_NOT_FOUND", `Stage not found: ${input}`);
  }

  return formatStageId(sequence);
}

function getCurrentCycleStageEntry(
  meta: StagesMeta,
  id: string,
): StageEntry | undefined {
  for (let index = meta.stages.length - 1; index >= 0; index -= 1) {
    const stage = meta.stages[index]!;
    if (stage.id === id && !stage.commitId) {
      return stage;
    }
  }
  return undefined;
}

export function formatCommitId(sequence: number): string {
  return `commit-${String(sequence).padStart(3, "0")}`;
}

export function parseCommitNumber(commitId: string): number | null {
  const match = /^commit-(\d+)$/.exec(commitId);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}

export function formatStageId(sequence: number): string {
  return `stage-${String(sequence).padStart(3, "0")}`;
}

export function generateStageId(meta: StagesMeta): string {
  return formatStageId(meta.nextId);
}

export function parseStageNumber(stageId: string): number | null {
  const match = /^stage-(\d+)$/.exec(stageId);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}

export function isCommitRef(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.startsWith("commit-")) {
    return true;
  }
  return /^c\d+$/i.test(trimmed);
}

export function resolveCommitId(meta: StagesMeta, input: string): string {
  const trimmed = input.trim();
  let sequence: number | null = null;

  if (trimmed.startsWith("commit-")) {
    sequence = parseCommitNumber(trimmed);
  } else {
    const match = /^c(\d+)$/i.exec(trimmed);
    sequence = match ? Number.parseInt(match[1], 10) : null;
  }

  if (sequence === null) {
    throw new StagesError("COMMIT_NOT_FOUND", `Commit not found: ${input}`);
  }

  const commitId = formatCommitId(sequence);
  const commit = meta.commits.find((item) => item.id === commitId);
  if (!commit) {
    throw new StagesError("COMMIT_NOT_FOUND", `Commit not found: ${commitId}`);
  }

  return commit.id;
}

function resolveCurrentCycleStageEntry(
  meta: StagesMeta,
  stageId: string,
): StageEntry {
  const stage = getCurrentCycleStageEntry(meta, stageId);
  if (!stage) {
    throw new StagesError("STAGE_NOT_FOUND", `Stage not found: ${stageId}`);
  }
  return stage;
}

export function getCommittedStageEntry(
  meta: StagesMeta,
  id: string,
): StageEntry | undefined {
  for (let index = meta.stages.length - 1; index >= 0; index -= 1) {
    const stage = meta.stages[index]!;
    if (stage.id === id && stage.commitId) {
      return stage;
    }
  }
  return undefined;
}

export function resolveCommittedStageEntry(
  meta: StagesMeta,
  input: string,
): StageEntry {
  const stageId = normalizeStageInput(input);
  const stage = getCommittedStageEntry(meta, stageId);
  if (!stage) {
    throw new StagesError("STAGE_NOT_FOUND", `Stage not found: ${stageId}`);
  }
  return stage;
}

export function resolveStageEntry(meta: StagesMeta, input: string): StageEntry {
  const stageId = normalizeStageInput(input);
  return resolveCurrentCycleStageEntry(meta, stageId);
}

export function resolveStageId(meta: StagesMeta, input: string): string {
  return resolveStageEntry(meta, input).id;
}

export function areContiguousIds(ids: string[]): boolean {
  const numbers = ids
    .map(parseStageNumber)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  if (numbers.length !== ids.length) {
    return false;
  }

  for (let index = 1; index < numbers.length; index += 1) {
    if (numbers[index] - numbers[index - 1] !== 1) {
      return false;
    }
  }

  return true;
}

export function suggestContiguousRange(ids: string[]): string {
  const numbers = ids
    .map(parseStageNumber)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  if (numbers.length === 0) {
    return "";
  }

  const start = numbers[0];
  const end = numbers[numbers.length - 1];
  const expected: string[] = [];
  for (let current = start; current <= end; current += 1) {
    expected.push(formatStageId(current));
  }

  return expected.join(", ");
}
