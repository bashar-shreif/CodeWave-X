import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

export const toPosix = (p: string) => p.replace(/\\/g, '/');
export const has = (files: Set<string>, rel: string) => files.has(toPosix(rel));
export const anyStartsWith = (files: Set<string>, prefixes: string[]) =>
  Array.from(files).some((p) => prefixes.some((pref) => p.startsWith(pref)));

export const readIfExists = async (root: string, rel: string, files: Set<string>) => {
  const pos = toPosix(rel);
  if (!files.has(pos)) return null;
  try {
    return await fsp.readFile(path.join(root, rel), 'utf8');
  } catch {
    return null;
  }
};

export const scoreToConfidence = (s: number): 'low' | 'medium' | 'high' =>
  s >= 7 ? 'high' : s >= 4 ? 'medium' : 'low';
