import * as fs from 'fs';
import * as path from 'path';
import { embedIndexPathFor } from '../agent/config';
import { loadIndex, cosine } from './helpers';
import type { EmbedIndex } from '../types/retrieval/retrieval.types';
import { embedTexts } from './providerEmbed.util';

export type RetrieveInput = {
  repoHash: string;
  query: string;
  k?: number;
  maxChars?: number;
  repoRoot?: string;
};
export type RetrieveOutput = {
  passages: Array<{ id: string; rel: string; body: string }>;
};

const readChunkText = (
  repoRoot: string,
  rel: string,
  start: number,
  end: number,
) => {
  const abs = path.join(repoRoot, rel);
  try {
    const buf = fs.readFileSync(abs);
    const slice = buf.subarray(start, Math.min(end, buf.length));
    return slice.toString('utf8');
  } catch {
    return '';
  }
};

export const retrieve = async (
  args: RetrieveInput,
): Promise<RetrieveOutput> => {
  const { repoHash, query } = args;
  const k = args.k ?? 6;
  const maxChars = args.maxChars ?? 1200;

  const indexPath = embedIndexPathFor(repoHash);
  const idx = loadIndex(indexPath) as EmbedIndex | undefined;
  if (!idx || !Array.isArray(idx.chunks) || idx.chunks.length === 0) {
    return { passages: [] };
  }

  const qv = (await embedTexts([query]))[0] || [];

  const scored = idx.chunks.map((c, i) => ({
    i,
    id: c.id,
    rel: c.rel,
    score: cosine(qv, c.v),
  }));
  scored.sort((a, b) => b.score - a.score);

  const picked: typeof scored = [];
  const seenRel = new Set<string>();
  for (const s of scored) {
    if (picked.length >= k) break;
    if (seenRel.has(s.rel)) continue;
    picked.push(s);
    seenRel.add(s.rel);
  }
  for (const s of scored) {
    if (picked.length >= k) break;
    if (!picked.some((p) => p.i === s.i)) picked.push(s);
  }

  const root = args.repoRoot ?? process.cwd();
  let budget = maxChars;
  const out: RetrieveOutput['passages'] = [];

  for (const p of picked) {
    const c = idx.chunks[p.i];
    const body = readChunkText(root, c.rel, c.start, c.end);
    if (!body) continue;
    const take = body.slice(0, Math.max(0, budget));
    if (!take.trim()) continue;

    out.push({ id: c.id, rel: c.rel, body: fenceWrap(c.rel, take) });

    budget -= take.length + 100;
    if (budget <= 0) break;
  }

  return { passages: out };
};

const fenceWrap = (rel: string, body: string) => {
  const ext = path.extname(rel).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'ts',
    '.tsx': 'tsx',
    '.js': 'js',
    '.jsx': 'jsx',
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
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.md': 'md',
    '.json': 'json',
    '.toml': 'toml',
    '.ini': 'ini',
  };
  const lang = map[ext] || '';
  return lang
    ? `# ${rel}\n\n\`\`\`${lang}\n${body}\n\`\`\``
    : `# ${rel}\n\n${body}`;
};
