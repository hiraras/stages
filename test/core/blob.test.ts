import { describe, expect, it } from "vitest";
import { storeBlob, readBlob } from "../../src/core/store/blob.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("blob store unit", () => {
  it("stores and reads blobs", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "stages-blob-"));
    const content = Buffer.from("hello");
    const hash = storeBlob(root, content);
    expect(readBlob(root, hash).toString()).toBe("hello");
    const hash2 = storeBlob(root, content);
    expect(hash2).toBe(hash);
  });
});
