import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import type { EmbedIndex } from '../types/retrieval/retrieval.types';

export const toPosix = (p: string) => p.replace(/\\/g, '/');

export const normalizeRel = (abs: string, repoRoot: string) =>
  toPosix(path.relative(repoRoot, abs));

export const sha1 = (data: string | Buffer) =>
  createHash('sha1').update(data).digest('hex');

export const cosine = (a: number[], b: number[]) => {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i],
      y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d ? dot / d : 0;
};

export const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

export const atomicWriteJson = (file: string, obj: unknown) => {
  const dir = path.dirname(file);
  ensureDir(dir);
  const tmp = path.join(dir, `.${path.basename(file)}.tmp-${Date.now()}`);
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, file);
};

export const readJson = <T = any>(file: string): T | undefined => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return undefined;
  }
};

export const repoLatestMtime = (root: string) => {
  let latest = 0;
  const skip = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const full = path.join(dir, e.name);
      try {
        const st = fs.statSync(full);
        latest = Math.max(latest, st.mtimeMs);
        if (e.isDirectory()) walk(full);
      } catch {}
    }
  };
  walk(root);
  return latest;
};

export const isFreshIndex = (indexPath: string, repoRoot: string) => {
  try {
    const st = fs.statSync(indexPath);
    return st.mtimeMs >= repoLatestMtime(repoRoot);
  } catch {
    return false;
  }
};

export const loadIndex = (indexPath: string): EmbedIndex | undefined =>
  readJson<EmbedIndex>(indexPath);
