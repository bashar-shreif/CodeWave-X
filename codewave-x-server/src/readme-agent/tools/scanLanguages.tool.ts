import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  ScanLanguagesInput,
  ScanLanguagesOutput,
} from '../types/scanLanguaage.types';
import { BINARY_EXTS } from '../constants/binaryExts.constant';
import { EXT_TO_LANG } from '../constants/languageExts.constant';

const normalizeLang = (lang: string): string => {
  switch (lang) {
    case 'typescriptreact':
      return 'typescript';
    case 'javascriptreact':
      return 'javascript';
    case 'php-blade':
      return 'php';
    default:
      return lang;
  }
};

const detectLanguage = (relPath: string): string => {
  const base = path.posix.basename(relPath);

  if (base === 'Dockerfile') return 'docker';
  if (base === 'Makefile') return 'make';
  if (base === 'CMakeLists.txt') return 'cmake';

  if (base.endsWith('.blade.php')) return 'php-blade';

  const ext = path.posix.extname(base).replace('.', '').toLowerCase();
  if (!ext) return 'other';
  return EXT_TO_LANG[ext] ?? (BINARY_EXTS.has(ext) ? 'binary' : 'other');
}

const countLOC = async (absPath: string): Promise<number> => {
  const stat = await fsp.stat(absPath);
  if (stat.size === 0) return 0;

  return await new Promise<number>((resolve, reject) => {
    const stream = fs.createReadStream(absPath);
    let loc = 0;
    let lastByte: number | null = null;

    stream.on('data', (chunk: Buffer) => {
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === 0x0a) loc++; // '\n'
        lastByte = chunk[i];
      }
    });
    stream.on('end', () => {
      if (lastByte !== 0x0a) loc++;
      resolve(loc);
    });
    stream.on('error', reject);
  });
}

export const scanLanguages = async (
  input: ScanLanguagesInput,
): Promise<ScanLanguagesOutput> => {
  const { repoRoot, manifest, normalize = true } = input;

  const byLanguage: Record<string, { files: number; loc: number }> = {};
  const totals = { files: 0, loc: 0 };

  for (const entry of manifest) {
    const rel = entry.path.replace(/\\/g, '/');
    const langRaw = detectLanguage(rel);
    if (langRaw === 'binary') continue;

    const lang = normalize ? normalizeLang(langRaw) : langRaw;

    const abs = path.resolve(repoRoot, rel);
    const loc = await countLOC(abs);

    if (!byLanguage[lang]) byLanguage[lang] = { files: 0, loc: 0 };
    byLanguage[lang].files += 1;
    byLanguage[lang].loc += loc;

    totals.files += 1;
    totals.loc += loc;
  }

  return { byLanguage, totals, method: 'LOC' };
}
