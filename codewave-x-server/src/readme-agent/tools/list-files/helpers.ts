import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import ignore from 'ignore';
import { DEFAULT_EXCLUDES } from '../../constants/excludes.constant';


export const hashFile = async (
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

export const loadGitignore = async (root: string) => {
  const ig = ignore();
  try {
    const txt = await fsp.readFile(path.join(root, '.gitignore'), 'utf8');
    const lines = txt
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('#'));
    ig.add(lines);
  } catch {}
  ig.add(DEFAULT_EXCLUDES);
  return ig;
};

export const relSafe = (root: string, abs: string): string => {
  const rel = path.posix.normalize(
    path.relative(root, abs).split(path.sep).join(path.posix.sep),
  );
  if (rel.startsWith('..')) throw new Error(`Path escapes root: ${abs}`);
  return rel;
};

