import { createStagesAPI, StagesError } from "../index.js";
import { findProjectRoot } from "../core/git/worktree.js";

export const api = createStagesAPI();

export function getRoot(): string {
  return findProjectRoot();
}

export function handleError(error: unknown): never {
  if (error instanceof StagesError) {
    console.error(`✗ Error: ${error.message}`);
    process.exit(1);
  }

  if (error instanceof Error) {
    console.error(`✗ Error: ${error.message}`);
    process.exit(1);
  }

  console.error("✗ Unknown error");
  process.exit(1);
}

export function success(message: string): void {
  console.log(`✓ ${message}`);
}

export function warn(message: string): void {
  console.warn(`⚠ ${message}`);
}
