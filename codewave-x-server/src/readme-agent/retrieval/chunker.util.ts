import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { READMEA } from '../agent/config';
import { normalizeRel, sha1 } from './helpers';

export type RawChunk = {
  id: string;
  rel: string;
  start: number;
  end: number;
  lang?: string;
  text: string;
  sha1: string;
};

const EXT_LANG: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.hpp': 'cpp',
  '.hh': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.sh': 'bash',
  '.ps1': 'powershell',
  '.sql': 'sql',
  '.json': 'json',
  '.jsonc': 'json',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'toml',
  '.ini': 'ini',
  '.properties': 'properties',
  '.env': 'env',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.rst': 'rst',
  '.txt': 'text',
};

const TARGET = READMEA.EMBED_TARGET_CHARS;
const OVERLAP = READMEA.EMBED_OVERLAP_CHARS;
const MAX_FILE = READMEA.EMBED_MAX_FILE_BYTES;

export const chunkFiles = (files: string[], repoRoot: string): RawChunk[] => {
  const out: RawChunk[] = [];
  for (const abs of files) {
    try {
      const st = fs.statSync(abs);
      if (!st.isFile() || st.size === 0 || st.size > MAX_FILE) continue;

      const buf = fs.readFileSync(abs);
      const text = buf.toString('utf8');
      if (!isMostlyText(text)) continue;

      const rel = normalizeRel(abs, repoRoot);
      const lang = EXT_LANG[path.extname(abs).toLowerCase()];
      const slices = splitText(text, TARGET, OVERLAP);

      for (const c of slices) {
        const startB = Buffer.byteLength(text.slice(0, c.start), 'utf8');
        const endB = startB + Buffer.byteLength(c.text, 'utf8');
        out.push({
          id: randomUUID(),
          rel,
          start: startB,
          end: endB,
          lang,
          text: c.text,
          sha1: sha1(c.text),
        });
      }
    } catch {}
  }
  return out;
};

const isMostlyText = (s: string) => {
  if (!s) return false;
  const sample = s.slice(0, 2048);
  const ctrl = sample.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g)?.length ?? 0;
  return ctrl < sample.length * 0.01;
};

type Slice = { start: number; end: number; text: string };

const splitText = (src: string, target: number, overlap: number): Slice[] => {
  const N = src.length;
  if (N === 0) return [];
  if (N <= target) return [{ start: 0, end: N, text: src }];

  const fences = locateFences(src);
  const chunks: Slice[] = [];

  let pos = 0;
  while (pos < N) {
    let end = Math.min(pos + target, N);
    end = Math.min(findSoftBoundary(src, end, 200), N);

    const fence = fenceContaining(fences, pos, end);
    if (fence && end < fence.end) end = fence.end;

    const { start: s2, end: e2 } = trimEdges(src, pos, end);
    if (e2 <= s2) {
      pos = Math.min(pos + Math.max(1, target), N);
      continue;
    }

    chunks.push({ start: s2, end: e2, text: src.slice(s2, e2) });

    if (e2 >= N) break;

    const next = Math.max(e2 - overlap, s2 + 1);
    if (next <= pos) break;
    pos = next;
  }
  return chunks;
};

type Fence = { start: number; end: number };
const locateFences = (s: string): Fence[] => {
  const out: Fence[] = [];
  const re = /```/g;
  let m: RegExpExecArray | null;
  const stack: number[] = [];
  while ((m = re.exec(s))) {
    const i = m.index;
    if (stack.length === 0) stack.push(i);
    else out.push({ start: stack.pop()!, end: i + 3 });
  }
  return out.sort((a, b) => a.start - b.start);
};
const fenceContaining = (f: Fence[], from: number, to: number) =>
  f.find((x) => x.start < to && from < x.end);
const findSoftBoundary = (s: string, idx: number, maxLook: number) => {
  const N = s.length;
  if (idx >= N) return N;
  const upto = Math.min(idx + maxLook, N);
  const nl = s.indexOf('\n', idx);
  return nl !== -1 && nl <= upto ? nl + 1 : idx;
};
const trimEdges = (s: string, from: number, to: number) => {
  while (from < to && isWS(s.charCodeAt(from))) from++;
  while (to > from && isWS(s.charCodeAt(to - 1))) to--;
  return { start: from, end: to };
};
const isWS = (c: number) => c === 32 || c === 9 || c === 10 || c === 13;
