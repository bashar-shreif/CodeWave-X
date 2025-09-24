import * as path from 'node:path';
import { detectStack } from '../detect-stacks';
import type { RouteEntry } from '../../types/tools/routeEntry.type';
import type {
  SummarizeRoutesInput,
  SummarizeRoutesOutput,
} from '../../types/tools/io.type';
import {
  parseDjangoRoutes,
  parseExpressRoutes,
  parseFlaskRoutes,
  parseLaravelRoutes,
  parseNestRoutes,
  readFileUtf8,
  toPosix,
} from './helpers';

export const summarizeRoutes = async (
  input: SummarizeRoutesInput,
): Promise<SummarizeRoutesOutput> => {
  const { repoRoot, manifest } = input;
  const files = new Set(manifest.map((m) => toPosix(m.path)));

  const stack = input.stack ?? (await detectStack({ repoRoot, manifest }));
  const fwSet = new Set<RouteEntry['framework']>(
    (stack.hits || [])
      .map((h) => h.stack.toLowerCase())
      .map((s) =>
        s.includes('laravel')
          ? 'laravel'
          : s.includes('nest')
            ? 'nest'
            : s.includes('django')
              ? 'django'
              : s.includes('flask')
                ? 'flask'
                : s.includes('express') || s === 'node.js'
                  ? 'express'
                  : null,
      )
      .filter(Boolean) as RouteEntry['framework'][],
  );

  const candidates: string[] = [];
  for (const m of manifest) {
    const rel = toPosix(m.path);
    if (/\.(php|js|ts|py)$/.test(rel)) {
      if (rel.startsWith('routes/') || rel.includes('/routes/'))
        candidates.push(rel);
      else if (rel.endsWith('.py') && /urls\.py$/.test(rel))
        candidates.push(rel);
      else if (/(controller|controllers|http\/controllers)/i.test(rel))
        candidates.push(rel);
      else if (/(router|routes|api)\.(js|ts)$/.test(rel)) candidates.push(rel);
      else if (/\.(js|ts)$/.test(rel) && /(express|nest|koa)/i.test(rel))
        candidates.push(rel);
    }
  }

  const unique = Array.from(new Set(candidates));
  const routes: RouteEntry[] = [];

  for (const rel of unique) {
    const abs = path.join(repoRoot, rel);
    const src = await readFileUtf8(abs);
    if (!src) continue;

    if (fwSet.has('laravel') && rel.endsWith('.php'))
      routes.push(...parseLaravelRoutes(rel, src));
    if (fwSet.has('express') && /\.(js|ts)$/.test(rel))
      routes.push(...parseExpressRoutes(rel, src));
    if (fwSet.has('nest') && /\.ts$/.test(rel))
      routes.push(...parseNestRoutes(rel, src));
    if (fwSet.has('django') && rel.endsWith('urls.py'))
      routes.push(...parseDjangoRoutes(rel, src));
    if (fwSet.has('flask') && rel.endsWith('.py'))
      routes.push(...parseFlaskRoutes(rel, src));
  }

  routes.sort((a, b) =>
    a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file),
  );
  return { routes, frameworksDetected: Array.from(fwSet).sort() };
};

export default summarizeRoutes;