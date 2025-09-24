import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import ignore from 'ignore';
import * as micromatch from 'micromatch';
import { DEFAULT_EXCLUDES } from '../../constants/excludes.constant';
import { ListFilesInput, ListFilesOutput } from '../../types/tools/io.type';
import { ManifestEntry } from '../../types/tools/manifest.type';
import { loadGitignore, relSafe, hashFile } from './helpers';
const KB = 1024;
const MB = 1024 * KB;

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
  const ignored: { path: string; reason: string }[] = [];
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

      const lst = await fsp.lstat(abs);
      if (lst.isSymbolicLink()) {
        ignored.push({ path: rel, reason: 'symlink' });
        continue;
      }

      if (ent.isDirectory()) {
        const relDir = rel.endsWith('/') ? rel : `${rel}/`;
        if (ig.ignores(relDir)) {
          ignored.push({ path: relDir, reason: 'defaultExcludes' });
          continue;
        }
        stack.push(abs);
        continue;
      }

      if (!ent.isFile()) continue;

      if (ig.ignores(rel)) continue;
      if (excludeGlobs.length && micromatch.isMatch(rel, excludeGlobs))
        continue;

      if (lst.size > sizeLimitMB * MB) {
        skipped++;
        continue;
      }

      if (includeGlobs.length && !micromatch.isMatch(rel, includeGlobs))
        continue;

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
    ignored,
  };
};

export default listFiles;
