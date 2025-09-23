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
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust', '.java': 'java', '.kt': 'kotlin', '.kts': 'kotlin',
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.hpp': 'cpp', '.hh': 'cpp',
  '.cs': 'csharp', '.php': 'php', '.sh': 'bash', '.ps1': 'powershell', '.sql': 'sql',
  '.json': 'json', '.jsonc': 'json', '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'toml', '.ini': 'ini', '.properties': 'properties',
  '.env': 'env', '.md': 'markdown', '.mdx': 'markdown', '.rst': 'rst', '.txt': 'text',
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
      const chunks = splitText(text, TARGET, OVERLAP);

      let prefixByteLenCache: number[] | null = null;
      const getByteOffset = (charIndex: number) => {
        if (!prefixByteLenCache) {
          prefixByteLenCache = new Array(text.length + 1);
          prefixByteLenCache[0] = 0;
        }
        const slice = text.slice(0, charIndex);
        return Buffer.byteLength(slice, 'utf8');
      };

      for (const c of chunks) {
        const startB = getByteOffset(c.start);
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
    } catch {
    }
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
  if (!src.trim()) return [];
  const fences = locateFences(src);
  const chunks: Slice[] = [];

  let pos = 0;
  const N = src.length;

  while (pos < N) {
    let end = Math.min(pos + target, N);

    const softEnd = findSoftBoundary(src, end, /*maxLook*/ 200);
    end = Math.min(softEnd, N);

    const fence = fenceContaining(fences, pos, end);
    if (fence && end < fence.end) end = fence.end;

    const { start: s2, end: e2 } = trimEdges(src, pos, end);
    if (e2 <= s2) {
      pos = Math.min(pos + Math.max(1, target), N);
      continue;
    }

    const text = src.slice(s2, e2);
    chunks.push({ start: s2, end: e2, text });

    if (e2 >= N) break;
    pos = Math.max(e2 - overlap, s2 + 1);
  }

  return chunks;
};

type Fence = { start: number; end: number };

const locateFences = (s: string): Fence[] => {
  const out: Fence[] = [];
  const fenceRe = /```/g;
  let m: RegExpExecArray | null;
  const starts: number[] = [];
  while ((m = fenceRe.exec(s))) {
    const idx = m.index;
    if (starts.length === 0) starts.push(idx);
    else {
      const st = starts.pop()!;
      out.push({ start: st, end: idx + 3 });
    }
  }
  return out.sort((a, b) => a.start - b.start);
};

const fenceContaining = (fences: Fence[], from: number, to: number): Fence | undefined =>
  fences.find((f) => f.start < to && from < f.end);

const findSoftBoundary = (s: string, idx: number, maxLook: number) => {
  const N = s.length;
  if (idx >= N) return N;
  const upto = Math.min(idx + maxLook, N);
  const nextNL = s.indexOf('\n', idx);
  if (nextNL !== -1 && nextNL <= upto) return nextNL + 1;
  return idx;
};

const trimEdges = (s: string, from: number, to: number) => {
  while (from < to && isWS(s.charCodeAt(from))) from++;
  while (to > from && isWS(s.charCodeAt(to - 1))) to--;
  return { start: from, end: to };
};

const isWS = (c: number) => c === 32 || c === 9 || c === 10 || c === 13;
