import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ignore from 'ignore';
import micromatch from 'micromatch';
import { DEFAULT_EXCLUDES } from '../constants/excludes.constant';
import { ListFilesInput, ListFilesOutput } from '../types/listFiles.types';
import { ManifestEntry } from '../types/manifest.type';

const KB = 1024;
const MB = 1024 * KB;

const hashFile = async (
  absPath: string,
): Promise<{ size: number; sha256: string }> => {
  const stat = await fsp.stat(absPath);
  const h = crypto.createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(absPath);
    stream.on('data', (chunk) => h.update(chunk));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  return { size: stat.size, sha256: h.digest('hex') };
};

const loadGitignore = async (root: string) => {
  const ig = ignore();
  try {
    const txt = await fsp.readFile(path.join(root, '.gitignore'), 'utf8');
    ig.add(txt.split(/\r?\n/));
  } catch {}
  ig.add(DEFAULT_EXCLUDES);
  return ig;
};

const relSafe = (root: string, abs: string): string => {
  const rel = path.posix.normalize(
    path.relative(root, abs).split(path.sep).join(path.posix.sep),
  );
  if (rel.startsWith('..')) throw new Error(`Path escapes root: ${abs}`);
  return rel;
};

export const listFiles = async (
  input: ListFilesInput,
): Promise<ListFilesOutput> => {
  const {
    repoUri,
    includeGlobs = ['**/*'],
    excludeGlobs = [],
    sizeLimitMB = 5,
    respectGitignore = true,
  } = input;

  const root = path.resolve(repoUri);
  const ig = respectGitignore
    ? await loadGitignore(root)
    : ignore().add(DEFAULT_EXCLUDES);

  const manifest: ManifestEntry[] = [];
  let skipped = 0;
  let totalBytes = 0;

  const stack: string[] = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      const rel = relSafe(root, abs);

      if (ig.ignores(rel)) continue;
      if (excludeGlobs.length && micromatch.isMatch(rel, excludeGlobs))
        continue;

      const lst = await fsp.lstat(abs);
      if (lst.isSymbolicLink()) continue;
      if (ent.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (!ent.isFile()) continue;

      if (includeGlobs.length && !micromatch.isMatch(rel, includeGlobs))
        continue;

      if (lst.size > sizeLimitMB * MB) {
        skipped++;
        continue;
      }

      const { size, sha256 } = await hashFile(abs);
      manifest.push({ path: rel, size, hash: sha256 });
      totalBytes += size;
    }
  }

  manifest.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const repoHasher = crypto.createHash('sha256');
  for (const f of manifest) {
    repoHasher.update(f.path);
    repoHasher.update('\0');
    repoHasher.update(f.hash);
    repoHasher.update('\n');
  }
  const repoHash = repoHasher.digest('hex');

  return {
    repoHash,
    manifest,
    totals: { files: manifest.length, bytes: totalBytes, skipped },
  };
};
