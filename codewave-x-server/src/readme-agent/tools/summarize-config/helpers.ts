import fs from 'fs/promises';
import path from 'path';

export const readJson = async <T = any>(p: string): Promise<T | null> => {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'));
  } catch {
    return null;
  }
};

export const pathExists = async (p: string): Promise<boolean> => {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
};

export const walk = async (root: string): Promise<string[]> => {
  const out: string[] = [];
  const stack = [root];
  const skip = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.nuxt',
    '.angular',
    '.svelte-kit',
    '.turbo',
    '.cache',
    '.venv',
    'venv',
  ]);
  while (stack.length) {
    const cur = stack.pop()!;
    const ents = await fs.readdir(cur, { withFileTypes: true });
    for (const e of ents) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (!skip.has(e.name)) stack.push(full);
      } else out.push(full);
    }
  }
  return out;
};

export const rel = (root: string, p: string) => path.relative(root, p);
