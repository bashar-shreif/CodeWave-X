import * as fs from "fs";
import * as path from "path";
import { IgnoreFn } from "./ignore.util";

export type WalkStats = { files: string[]; totalBytes: number };

export const walkIncluded = (root: string, isIgnored: IgnoreFn): WalkStats => {
  const files: string[] = [];
  let totalBytes = 0;

  const stack: string[] = ["."];
  while (stack.length) {
    const rel = stack.pop()!;
    const abs = path.join(root, rel);
    const st = fs.statSync(abs, { throwIfNoEntry: false });
    if (!st) continue;

    if (st.isDirectory()) {
      if (isIgnored(rel, true)) continue;
      const entries = fs.readdirSync(abs, { withFileTypes: true });
      for (const d of entries) {
        const childRel = rel === "." ? d.name : path.posix.join(rel, d.name);
        stack.push(childRel);
      }
    } else if (st.isFile()) {
      if (isIgnored(rel, false)) continue;
      files.push(rel);
      totalBytes += st.size;
    }
  }
  return { files, totalBytes };
};
