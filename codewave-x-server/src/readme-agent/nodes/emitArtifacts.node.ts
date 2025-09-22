import fs from 'fs/promises';
import path from 'path';
import type { GraphState } from '../agent/state';

const writeJson = async (p: string, obj: any) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(obj ?? {}, null, 2), 'utf8');
};
const writeText = async (p: string, text: string) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, text ?? '', 'utf8');
};
const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);

export const emitArtifactsNode = async (
  s: GraphState,
): Promise<Partial<GraphState>> => {
  const repoKey =
    (s as any).repoHash ||
    safe(path.basename(path.resolve(s.repoRoot))) ||
    'adhoc';
  const base = path.join('artifacts', repoKey);

  const jobs: Array<Promise<any>> = [];
  const jsons: Array<[string, any]> = [
    ['manifest.json', s.manifest],
    ['lang_profile.json', s.langProfile],
    ['stack.json', s.stack],
    ['deps.json', s.deps],
    ['routes.json', s.routes],
    ['architecture.json', s.architecture],
    ['tests.json', s.tests],
    ['config.json', s.config],
    ['ci.json', s.ci],
    ['docs.json', s.docs],
    ['security.json', s.security],
    ['sections.json', s.draft?.sections],
  ];
  for (const [name, obj] of jsons) {
    if (obj != null) jobs.push(writeJson(path.join(base, name), obj));
  }

  const draftMd = (() => {
    const secs = s.draft?.sections || {};
    const order = [
      'Overview',
      'Tech Stack',
      'Dependencies',
      'Architecture',
      'Diagrams',
      'Getting Started',
      'Routes',
      'Configuration',
      'Scripts',
      'Testing',
      'CI',
      'Documentation',
      'Security',
      'Contributing',
      'License',
    ];

    const parts: string[] = [];
    for (const key of order) {
      if (secs[key]) {
        parts.push(`# ${key}`);
        parts.push(String(secs[key]).trim(), '');
      }
    }
    return parts.join('\n').trim() + '\n';
  })();

  if (Object.keys(s.draft?.sections || {}).length > 0) {
    jobs.push(writeText(path.join(base, 'README.DRAFT.md'), draftMd));
  }
  if (s.final?.markdown) {
    jobs.push(writeText(path.join(base, 'README.md'), s.final.markdown));
  }

  await Promise.all(jobs);
  return { final: { ...(s.final || {}), artifactsDir: base } as any };
};
