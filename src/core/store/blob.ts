import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { StagesError } from "../errors.js";
import { getBlobsDir } from "../paths.js";

export function hashContent(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function normalizeLineEndings(content: Buffer): Buffer {
  return Buffer.from(content.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
}

export function hashNormalizedContent(content: Buffer): string {
  return hashContent(normalizeLineEndings(content));
}

function getBlobPath(projectRoot: string, hash: string): string {
  const prefix = hash.slice(0, 2);
  const suffix = hash.slice(2);
  return path.join(getBlobsDir(projectRoot), prefix, suffix);
}

export function blobExists(projectRoot: string, hash: string): boolean {
  return fs.existsSync(getBlobPath(projectRoot, hash));
}

export function storeBlob(projectRoot: string, content: Buffer): string {
  const hash = hashContent(content);
  const blobPath = getBlobPath(projectRoot, hash);

  if (fs.existsSync(blobPath)) {
    return hash;
  }

  fs.mkdirSync(path.dirname(blobPath), { recursive: true });
  fs.writeFileSync(blobPath, content);

  const written = fs.readFileSync(blobPath);
  if (hashContent(written) !== hash) {
    throw new StagesError("BLOB_CORRUPT", `Blob integrity check failed: ${hash}`);
  }

  return hash;
}

export function readBlob(projectRoot: string, hash: string): Buffer {
  const blobPath = getBlobPath(projectRoot, hash);
  if (!fs.existsSync(blobPath)) {
    throw new StagesError("BLOB_CORRUPT", `Blob not found: ${hash}`);
  }

  const content = fs.readFileSync(blobPath);
  if (hashContent(content) !== hash) {
    throw new StagesError("BLOB_CORRUPT", `Blob corrupted: ${hash}`);
  }

  return content;
}
