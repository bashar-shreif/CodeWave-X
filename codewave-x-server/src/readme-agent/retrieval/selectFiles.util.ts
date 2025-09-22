import * as fs from 'fs';
import * as path from 'path';
import { READMEA } from '../agent/config';

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.vercel',
  '.cache',
  '.turbo',
  '.idea',
  '.vscode',
  '.DS_Store',
  '.pnpm-store',
  '.yarn',
  '.gradle',
  'target',
  'vendor/bin',
]);

const SKIP_FILE_PATTERNS = [
  /\.lock$/,
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|composer\.lock|Cargo\.lock|poetry\.lock)$/,
  /\.(png|jpg|jpeg|gif|webp|ico|bmp|tiff|psd|ai|sketch|pdf|zip|tar|gz|bz2|7z|rar|wasm|woff2?|ttf|otf|mp4|mp3|mov|avi)$/i,
];

const ALLOW_EXT = new Set([
  // code
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.kts',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.cc',
  '.hh',
  '.cs',
  '.php',
  '.sh',
  '.ps1',
  '.sql',
  // configs
  '.json',
  '.jsonc',
  '.yml',
  '.yaml',
  '.toml',
  '.ini',
  '.env',
  '.env.example',
  '.properties',
  // docs
  '.md',
  '.mdx',
  '.rst',
  '.txt',
]);

const DOC_ALLOW = new Set([
  'README',
  'CHANGELOG',
  'LICENSE',
  'CONTRIBUTING',
  'SECURITY',
]);

const isAllowedFile = (full: string) => {
  const base = path.basename(full);
  const ext = path.extname(base).toLowerCase();

  if (SKIP_FILE_PATTERNS.some((re) => re.test(full))) return false;

  if (ALLOW_EXT.has(ext)) return true;

  const stem = base.replace(ext, '').toUpperCase();
  if (DOC_ALLOW.has(stem)) return true;

  return false;
};

export const selectFiles = (
  root: string,
  maxRepoBytes = READMEA.EMBED_MAX_REPO_BYTES,
  maxFileBytes = READMEA.EMBED_MAX_FILE_BYTES,
) => {
  const files: string[] = [];
  let bytes = 0;

  const walk = (dir: string) => {
    let ents: fs.Dirent[];
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const e of ents) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);

      try {
        const st = fs.statSync(full);
        if (e.isDirectory()) {
          walk(full);
        } else if (e.isFile()) {
          if (!isAllowedFile(full)) continue;
          if (st.size === 0 || st.size > maxFileBytes) continue;
          if (bytes + st.size > maxRepoBytes) continue;
          files.push(full);
          bytes += st.size;
        }
      } catch {}
    }
  };

  walk(root);
  return { files, bytes };
};

export const debugSelect = (root: string) => {
  const { files, bytes } = selectFiles(root);
  const byExt = new Map<string, number>();
  for (const f of files) {
    const ext = path.extname(f).toLowerCase() || '_none';
    byExt.set(ext, (byExt.get(ext) || 0) + 1);
  }
  return {
    count: files.length,
    bytes,
    byExt: Object.fromEntries([...byExt.entries()].sort()),
  };
};
