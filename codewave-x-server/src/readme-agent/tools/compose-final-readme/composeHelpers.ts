import fs from 'fs/promises';
import path from 'path';
import { Draft } from '../../types/draft.type';

export const pathExists = async (p: string) => {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
};
export const readJson = async <T = any>(p: string): Promise<T | null> => {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'));
  } catch {
    return null;
  }
};

export const ghAnchor = (s: string) =>
  s
    .toLowerCase()
    .replace(/[`~!@#$%^&*()+={}\[\]|\\:;"'<>,.?/]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const clean = (s?: string) =>
  String(s || '')
    .trim()
    .replace(/\n{3,}/g, '\n\n');

export const dedupeLines = (s: string) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of s.split('\n')) {
    const key = line.trim();
    if (key === '' || !seen.has(key)) out.push(line);
    if (key !== '') seen.add(key);
  }
  return out.join('\n');
};

export const pickPkgMeta = async (repoRoot: string) => {
  const pkg = await readJson<any>(path.join(repoRoot, 'package.json'));
  if (!pkg) return {};
  const repoUrl =
    typeof pkg.repository === 'string'
      ? pkg.repository
      : pkg.repository && pkg.repository.url
        ? pkg.repository.url
        : undefined;
  return {
    name: pkg.name as string | undefined,
    version: pkg.version as string | undefined,
    license: pkg.license as string | undefined,
    repoUrl: repoUrl as string | undefined,
    enginesNode: pkg.engines?.node as string | undefined,
  };
};

export const makeBadges = (meta: Awaited<ReturnType<typeof pickPkgMeta>>) => {
  const badges: string[] = [];
  if (meta.license)
    badges.push(
      `![license](https://img.shields.io/badge/license-${encodeURIComponent(meta.license)}-informational)`,
    );
  if (meta.enginesNode)
    badges.push(
      `![node](https://img.shields.io/badge/node-${encodeURIComponent(meta.enginesNode)}-success)`,
    );
  if (meta.version)
    badges.push(
      `![version](https://img.shields.io/badge/version-${encodeURIComponent(meta.version)}-blue)`,
    );
  return badges.join(' ');
};

export const mapSections = (draft: Draft) => {
  const src = draft.sections || {};
  const out: Record<string, string> = {};

  const remap: Array<[string, string]> = [
    ['Description', 'Overview'],
    ['Tech Stack', 'Tech Stack'],
    ['Features', 'Features'],
    ['Architecture', 'Architecture'],
    ['Getting Started', 'Getting Started'],
    ['Routes', 'Routes'],
    ['Configuration', 'Configuration'],
    ['Testing', 'Testing'],
    ['CI', 'CI'],
    ['Documentation', 'Documentation'],
    ['Security', 'Security'],
    ['Contributing', 'Contributing'],
    ['License', 'License'],
  ];

  for (const [from, to] of remap) {
    const v = clean(src[from]);
    if (v) out[to] = v;
  }
  return out;
};

export const orderSections = (sections: Record<string, string>) => {
  const order = [
    'Overview',
    'Badges',
    'Table of Contents',
    'Tech Stack',
    'Features',
    'Architecture',
    'Getting Started',
    'Routes',
    'Configuration',
    'Testing',
    'CI',
    'Documentation',
    'Security',
    'Contributing',
    'License',
  ];
  const present = order.filter((k) => sections[k]);
  return present;
};

export const makeTOC = (outline: string[]) => {
  if (!outline.length) return '';
  const items = outline
    .filter((h) => h !== 'Badges' && h !== 'Table of Contents')
    .map((h) => `- [${h}](#${ghAnchor(h)})`)
    .join('\n');
  return items ? `\n${items}\n` : '';
};
