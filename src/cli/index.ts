#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runSnap } from "./commands/snap.js";
import { runInit } from "./commands/init.js";
import { runList } from "./commands/list.js";
import { runShow } from "./commands/show.js";
import { runStatus } from "./commands/status.js";
import { runMerge } from "./commands/merge.js";
import { runCommit } from "./commands/commit.js";
import { runVerify } from "./commands/verify.js";
import { runLog } from "./commands/log.js";
import { runDrop } from "./commands/drop.js";
import {
  runHide,
  runRename,
  runUnhide,
} from "./commands/lifecycle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.resolve(__dirname, "../../package.json");
const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as { version: string };

const SUBCOMMANDS = [
  "snap",
  "init",
  "list",
  "show",
  "merge",
  "rename",
  "commit",
  "log",
  "verify",
  "hide",
  "unhide",
  "drop",
  "status",
];

function parseSnapMessage(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-m" || arg === "--message") {
      return argv[index + 1];
    }
    if (arg.startsWith("--message=")) {
      return arg.slice("--message=".length);
    }
    if (arg.startsWith("-m") && arg.length > 2) {
      return arg.slice(2);
    }
  }
  return undefined;
}

const HELP_FLAGS = new Set(["-h", "--help", "-V", "--version"]);

function isDefaultSnapInvocation(argv: string[]): boolean {
  if (argv.length === 0) {
    return true;
  }
  const first = argv[0];
  if (HELP_FLAGS.has(first)) {
    return false;
  }
  if (first.startsWith("-")) {
    return true;
  }
  return !SUBCOMMANDS.includes(first);
}

const program = new Command();

program
  .name("stages")
  .description("Cross-session code staging layer for AI-assisted development")
  .version(pkg.version);

program
  .command("snap", { hidden: true })
  .description("Save current workspace as a new stage")
  .option("-m, --message <message>", "Stage name / message")
  .action(async (options: { message?: string }) => {
    await runSnap(options.message);
  });

program
  .command("init")
  .description("Initialize stages in the current project")
  .action(async () => {
    await runInit();
  });

program
  .command("list")
  .description("List all stages")
  .option("--all", "Include hidden stages")
  .action(async (options: { all?: boolean }) => {
    await runList(options.all ?? false);
  });

program
  .command("show <id>")
  .description("Show diff for a stage or commit")
  .option("--stat", "Show file stats only")
  .option("--open", "Open diff in editor")
  .action(async (id: string, options: { stat?: boolean; open?: boolean }) => {
    await runShow(id, options);
  });

program
  .command("merge <ids...>")
  .description("Merge contiguous stages")
  .requiredOption("--name <name>", "Name for merged stage")
  .action(async (ids: string[], options: { name: string }) => {
    await runMerge(ids, options.name);
  });

program
  .command("rename <id> <name>")
  .description("Rename a stage")
  .action(async (id: string, name: string) => {
    await runRename(id, name);
  });

program
  .command("commit")
  .description("Commit current cycle stages to working tree")
  .requiredOption("-m, --message <message>", "Commit message")
  .option("--force", "Force apply when working tree is dirty")
  .action(async (options: { message: string; force?: boolean }) => {
    await runCommit(options.message, options.force ?? false);
  });

program
  .command("log")
  .description("Show stages commit history")
  .action(async () => {
    await runLog();
  });

program
  .command("verify")
  .description("Verify all stages are committed and working tree is clean")
  .action(async () => {
    await runVerify();
  });

program
  .command("hide <id>")
  .description("Hide a committed stage from list")
  .action(async (id: string) => {
    await runHide(id);
  });

program
  .command("unhide <id>")
  .description("Unhide a committed stage")
  .action(async (id: string) => {
    await runUnhide(id);
  });

program
  .command("drop <id>")
  .description("Drop stages from the given id onward and restore the worktree")
  .option("-y, --yes", "Skip confirmation prompt")
  .option("--force", "Force restore when working tree is dirty")
  .action(async (id: string, options: { yes?: boolean; force?: boolean }) => {
    await runDrop(id, options.yes ?? false, options.force ?? false);
  });

program
  .command("status")
  .description("Show stages status summary")
  .action(async () => {
    await runStatus();
  });

const argv = process.argv.slice(2);

function handleCliError(error: unknown): void {
  if (error instanceof Error) {
    console.error(`✗ Error: ${error.message}`);
  } else {
    console.error("✗ Unknown error");
  }
  process.exit(1);
}

if (isDefaultSnapInvocation(argv)) {
  runSnap(parseSnapMessage(argv)).catch(handleCliError);
} else {
  program.parseAsync(process.argv).catch(handleCliError);
}
