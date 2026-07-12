import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export function createSimpleProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stages-test-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "index.ts"),
    'export function greet(name: string) { return `Hello, ${name}!`; }\n',
  );
  fs.writeFileSync(
    path.join(root, "src", "math.ts"),
    "export function add(a: number, b: number) { return a + b; }\n",
  );
  fs.writeFileSync(
    path.join(root, "src", "config.ts"),
    'export const APP_NAME = "stages-demo";\n',
  );
  fs.writeFileSync(path.join(root, ".gitignore"), "node_modules/\n.stages/\n");
  return root;
}

export function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function initTestRepo(dir: string): void {
  runGit(dir, ["init"]);
  runGit(dir, ["config", "user.email", "test@example.com"]);
  runGit(dir, ["config", "user.name", "Test User"]);
}

export function commitAll(dir: string, message: string): void {
  runGit(dir, ["add", "."]);
  runGit(dir, ["commit", "-m", message]);
}

export function gitStatusPorcelain(dir: string): string {
  return runGit(dir, ["status", "--porcelain"]);
}
