import type { GraphState } from '../agent/state';
import { discoverSubprojects } from '../utils/discoverSubproject.util';
import * as path from 'path';

type SubprojectSummary = {
  name: string;
  root: string;
  stack: string[];
  languages: Record<string, any>;
  routesCount: number;
  artifactsDir?: string;
};

const formatLanguages = (languages: Record<string, any>): string => {
  const entries = Object.entries(languages || {});
  const norm = entries.map(([k, v]) => {
    let score: number | undefined;
    if (typeof v === 'number') score = v;
    else if (v && typeof v === 'object') {
      if (typeof v.percent === 'number') score = v.percent;
      else if (typeof (v as any).share === 'number')
        score = (v as any).share * 100;
      else if (typeof (v as any).ratio === 'number')
        score = (v as any).ratio * 100;
      else if (typeof (v as any).bytes === 'number') score = (v as any).bytes;
    }
    return { k, v, score: Number.isFinite(score) ? (score as number) : 0 };
  });

  norm.sort((a, b) => b.score - a.score);
  const top = norm.slice(0, 6);

  return top
    .map(({ k, v, score }) => {
      if (typeof v === 'number') return `${k} ${Math.round(v)}%`;
      if (v && typeof v === 'object') {
        if (typeof v.percent === 'number')
          return `${k} ${Math.round(v.percent)}%`;
        if (typeof (v as any).share === 'number')
          return `${k} ${Math.round((v as any).share * 100)}%`;
        if (typeof (v as any).ratio === 'number')
          return `${k} ${Math.round((v as any).ratio * 100)}%`;
      }
      return k;
    })
    .join(', ');
};

export const aggregateSubprojectsNode = async (
  state: GraphState,
): Promise<Partial<GraphState>> => {
  if (state.meta?.isSubgraph) return {};

  const root = state.repo.root;
  const subs = await discoverSubprojects(root);
  if (!Array.isArray(subs) || subs.length <= 1) {
    return { meta: { ...state.meta, subprojects: [] } };
  }

  const run = (state as any).__runSubgraph as
    | undefined
    | ((r: string) => Promise<any>);
  if (!run) return { meta: { ...state.meta, subprojects: [] } };

  const summaries: SubprojectSummary[] = [];
  for (const sp of subs) {
    const res: any = await run(sp.root);
    const stack = Array.isArray(res?.stack?.hits)
      ? res.stack.hits.map((h: any) => String(h.stack))
      : [];
    const languages = (res?.langProfile?.byLanguage ??
      res?.langProfile?.languages ??
      {}) as Record<string, any>;
    const routesCount = Array.isArray(res?.routes?.items)
      ? res.routes.items.length
      : 0;
    const artifactsDir = path.join(
      'artifacts',
      String(res?.repoHash ?? state.repoHash ?? state.repo.hash ?? ''),
    );
    summaries.push({
      name: String(sp.name),
      root: String(sp.root),
      stack,
      languages,
      routesCount,
      artifactsDir,
    });
  }

  const lines: string[] = [
    '# Monorepo Overview',
    '',
    '| App | Stack | Languages | Routes |',
    '| --- | ----- | --------- | ------ |',
    ...summaries.map((s) => {
      const st = s.stack.length ? s.stack.join(', ') : '-';
      const lg = formatLanguages(s.languages);
      return `| ${s.name} | ${st} | ${lg} | ${s.routesCount} |`;
    }),
    '',
    '## Quickstart',
    'Open each subproject README in its artifacts folder.',
  ];

  const prevSections = (state.writer?.sections as any[]) || [];
  const newSections = [
    {
      id: 'monorepo_overview',
      title: 'Monorepo Overview',
      body: lines.join('\n'),
    },
    ...prevSections,
  ];

  return {
    writer: { ...(state.writer || {}), sections: newSections },
    meta: { ...state.meta, subprojects: summaries },
  } as any;
};
