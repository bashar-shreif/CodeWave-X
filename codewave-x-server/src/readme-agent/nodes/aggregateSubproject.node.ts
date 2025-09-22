import type { GraphState } from '../agent/state';
import { discoverSubprojects } from '../utils/discoverSubproject.util';
import * as path from 'path';

type SubSummary = {
  name: string;
  root: string;
  stack?: string[];
  languages?: Record<string, number>;
  routesCount?: number;
  artifactsDir?: string;
};

export const aggregateSubprojectsNode = async (
  state: GraphState,
): Promise<Partial<GraphState>> => {
  const root = state.repo.root;
  const subs = await discoverSubprojects(root);
  if (subs.length <= 1) {
    return { meta: { ...state.meta, subprojects: [] } };
  }

  const summaries: SubSummary[] = [];
  if (typeof (state as any).__runSubgraph !== 'function') {
    return { meta: { ...state.meta, subprojects: [] } };
  }

  for (const sp of subs) {
    const res = await (state as any).__runSubgraph(sp.root);
    summaries.push({
      name: sp.name,
      root: sp.root,
      stack: res?.stack?.hits?.map((h: any) => h.stack) ?? [],
      languages:
        res?.langProfile?.byLanguage ?? res?.langProfile?.languages ?? {},
      routesCount: (res?.routes?.items || []).length ?? 0,
      artifactsDir: path.join('artifacts', state.repo.hash as string),
    });
  }

  const parentSections = [
    '# Monorepo Overview',
    '',
    '| App | Stack | Languages | Routes |',
    '| --- | ----- | --------- | ------ |',
    ...summaries.map((s) => {
      const st = (s.stack || []).join(', ');
      const lg = Object.entries(s.languages || {})
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}:${v}`)
        .join(', ');
      return `| ${s.name} | ${st} | ${lg} | ${s.routesCount ?? 0} |`;
    }),
    '',
    '## Quickstart',
    'See each subproject README in its artifact folder.',
  ].join('\n');

  return {
    writer: {
      ...(state.writer || {}),
      sections: [
        {
          id: 'monorepo_overview',
          title: 'Monorepo Overview',
          body: parentSections,
        },
        ...((state.writer?.sections as any[]) || []),
      ],
    },
    meta: { ...state.meta, subprojects: summaries },
  } as any;
};
