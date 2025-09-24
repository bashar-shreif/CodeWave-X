import fs from 'fs/promises';
import path from 'path';

export const pathExists = async (p: string): Promise<boolean> => {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
};

export const readText = async (
  p: string,
  maxBytes = 300_000,
): Promise<string | null> => {
  try {
    const buf = await fs.readFile(p);
    const slice = buf.subarray(0, Math.min(buf.length, maxBytes));
    return slice.toString('utf8');
  } catch {
    return null;
  }
};

export const readJson = async <T = any>(p: string): Promise<T | null> => {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'));
  } catch {
    return null;
  }
};

export const walk = async (root: string): Promise<string[]> => {
  const out: string[] = [];
  const stack: string[] = [root];
  const skip = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    '.next',
    '.nuxt',
    '.turbo',
    '.cache',
    '.venv',
    'venv',
    '.pnpm-store',
    '.gradle',
    '.idea',
    '.vscode',
  ]);
  while (stack.length) {
    const cur = stack.pop()!;
    let ents: any[] = [];
    try {
      ents = await fs.readdir(cur, { withFileTypes: true });
    } catch {
      continue;
    }
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

export const isMarkdown = (bn: string) => /\.(md|mdx)$/i.test(bn);

export const isOpenApiName = (bn: string) =>
  /(openapi|swagger)\.(ya?ml|json)$/i.test(bn) ||
  /^(api|openapi)\.(ya?ml|json)$/i.test(bn);

export const extractHeadings = (md: string): string[] =>
  md
    .split(/\r?\n/)
    .filter((l) => /^#{1,3}\s+/.test(l))
    .slice(0, 12)
    .map((h) => h.replace(/^#{1,6}\s+/, '').trim())
    .filter(Boolean);

export const extractTitle = (md: string): string | undefined =>
  md.match(/^#\s+(.+)$/m)?.[1]?.trim();

export const extractSummary = (md: string): string | undefined => {
  const stripped = md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6} .+$/gm, '')
    .trim();
  const para = stripped
    .split(/\n{2,}/)
    .map((s) => s.replace(/\n/g, ' ').trim())
    .find((s) => s.length > 0);
  if (!para) return undefined;
  return para.length > 240 ? para.slice(0, 237) + '...' : para;
};

export const detectTopicHits = (title: string, headings: string[], body: string) => {
  const has = (re: RegExp) =>
    re.test(title) || headings.some((h) => re.test(h)) || re.test(body);
  return {
    setup: has(/\b(setup|install|getting started)\b/i),
    usage: has(/\b(usage|how to run|run|examples)\b/i),
    contributing: has(/\b(contributing|contribution|code of conduct)\b/i),
    architecture: has(/\b(architecture|design|system design|adr)\b/i),
    api: has(/\b(api|endpoints|openapi|swagger)\b/i),
    changelog: has(/\b(changelog|release notes)\b/i),
    license: has(/\b(license)\b/i),
    security: has(/\b(security|secrets|vulnerability)\b/i),
    testing: has(/\b(test|testing|coverage)\b/i),
  };
};

export const parseOpenApi = async (
  abs: string,
): Promise<{ title?: string; version?: string; endpoints?: number } | null> => {
  const bn = path.basename(abs).toLowerCase();
  if (bn.endsWith('.json')) {
    const j = await readJson<any>(abs);
    if (!j) return null;
    const endpoints = j.paths ? Object.keys(j.paths).length : undefined;
    const title = j.info?.title || undefined;
    const version = j.openapi || j.swagger || j.info?.version || undefined;
    return { title, version, endpoints };
  } else {
    const txt = await readText(abs);
    if (!txt) return null;
    const version =
      txt.match(/^\s*openapi:\s*["']?([0-9.]+)["']?/m)?.[1] ||
      txt.match(/^\s*swagger:\s*["']?([0-9.]+)["']?/m)?.[1];
    // count path keys like:
    // paths:\n  /users:\n    get:
    const pathsBlock = txt.match(/^\s*paths:\s*\n([\s\S]+)/m)?.[1] || '';
    const pathKeys =
      (pathsBlock.match(/^\s{2,}\/[A-Za-z0-9._~\-\/{}:+]+:/gm) || []).length ||
      undefined;
    const title = txt.match(
      /^\s*info:\s*\n(?:\s{2,}.+\n)*?\s{2,}title:\s*["']?(.+?)["']?\s*$/m,
    )?.[1];
    return { title, version, endpoints: pathKeys };
  }
};