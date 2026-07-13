import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getFileAtCommit } from "../../core/git/head.js";
import { getBaseline } from "../../core/stage/init.js";
import { isCommitRef, resolveStageId } from "../../core/store/id.js";
import { changeTypeLabel } from "../../core/store/manifest.js";
import { getStage, readMeta } from "../../core/store/meta.js";
import { api, getRoot, handleError } from "../utils.js";

function detectEditor(): string | null {
  for (const candidate of ["cursor", "code"]) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // try next
    }
  }
  return process.env.EDITOR ?? null;
}

async function openDiff(stageId: string): Promise<void> {
  const root = getRoot();
  const result = api.show(root, stageId);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stages-open-"));
  const meta = readMeta(root);
  const resolvedId = resolveStageId(meta, stageId);
  const stage = getStage(root, resolvedId);
  const prevId = await api.getPrevStageId(root, stageId);
  const useBaseline = prevId === null;

  try {
    const editor = detectEditor();
    if (!editor) {
      throw new Error("No editor found. Install Cursor/VS Code or set EDITOR.");
    }

    for (const file of result.files) {
      const oldPath = path.join(tempRoot, "old", file.path);
      const newPath = path.join(tempRoot, "new", file.path);
      fs.mkdirSync(path.dirname(oldPath), { recursive: true });
      fs.mkdirSync(path.dirname(newPath), { recursive: true });

      let oldContent: Buffer | null = null;
      if (prevId) {
        oldContent = await api.readFile(root, prevId, file.path);
      } else {
        oldContent = getFileAtCommit(root, getBaseline(root), file.path);
      }
      const newContent = await api.readFile(root, stageId, file.path);

      fs.writeFileSync(oldPath, oldContent ?? "");
      fs.writeFileSync(newPath, newContent ?? "");

      execFileSync(editor, ["--diff", oldPath, newPath], { stdio: "inherit" });
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export async function runShow(
  id: string,
  opts: { stat?: boolean; open?: boolean },
): Promise<void> {
  try {
    if (opts.open && isCommitRef(id)) {
      console.error("✗ Error: --open is not supported for commit show.");
      process.exit(1);
    }

    if (opts.open) {
      await openDiff(id);
      return;
    }
    const result = api.show(getRoot(), id);
    if (result.files.length === 0) {
      console.log("No changes.");
      return;
    }

    if (opts.stat) {
      for (const file of result.files) {
        console.log(`${changeTypeLabel(file.type)}  ${file.path}`);
      }
      console.log(
        `${result.stats.files} files changed (+${result.stats.additions}, -${result.stats.deletions})`,
      );
      return;
    }

    const output = result.files.map((file) => file.diff).join("\n");
    if (!output.trim()) {
      console.log("No changes.");
      return;
    }

    console.log(output);
  } catch (error) {
    handleError(error);
  }
}
