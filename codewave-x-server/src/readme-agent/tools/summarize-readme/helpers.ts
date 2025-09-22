import fs from 'fs/promises';
import path from 'path';

export const pathExists = async (p: string) => {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
};

export const safeArr = (v: any): string[] => (Array.isArray(v) ? v : []);

export const take = <T>(a: T[], n: number) => a.slice(0, n);

export const deriveName = async (repoRoot: string, fallback?: string) => {
  if (fallback) return fallback;
  const bn = path.basename(path.resolve(repoRoot));
  if (await pathExists(path.join(repoRoot, 'package.json'))) {
    try {
      const pkg = JSON.parse(
        await fs.readFile(path.join(repoRoot, 'package.json'), 'utf8'),
      );
      if (pkg?.name) return String(pkg.name);
    } catch {}
  }
  return bn || 'Project';
};

export const pickPkgMgr = (deps: any) => {
  const mgrs = new Set<string>(
    safeArr(deps?.pkgManagers || deps?.managers || []),
  );
  const scripts = deps?.scripts || {};
  if (mgrs.has('pnpm'))
    return { i: 'pnpm i', run: (s: string) => `pnpm ${s}`, scripts };
  if (mgrs.has('yarn'))
    return { i: 'yarn', run: (s: string) => `yarn ${s}`, scripts };
  if (mgrs.has('npm'))
    return { i: 'npm ci', run: (s: string) => `npm run ${s}`, scripts };
  if (deps?.composer)
    return {
      i: 'composer install',
      run: (s: string) => `composer ${s}`,
      scripts,
    };
  return { i: 'npm ci', run: (s: string) => `npm run ${s}`, scripts };
};

export const fmtList = (items: string[]) =>
  items.length ? items.map((x) => `- ${x}`).join('\n') : '- N/A';

export const mkTechStack = (stack: any, langProfile: any, deps: any) => {
  const langs = Object.entries(langProfile?.languages || {})
    .sort((a: any, b: any) => b[1] - a[1])
    .map(([k]: any) => k);
  const frameworks = safeArr(
    stack?.frameworks || stack?.stacks || stack?.detected,
  ).slice(0, 8);
  const pkgMgrs = safeArr(deps?.pkgManagers || deps?.managers);
  const lines: string[] = [];
  if (langs.length) lines.push(`**Languages:** ${take(langs, 6).join(', ')}`);
  if (frameworks.length) lines.push(`**Frameworks:** ${frameworks.join(', ')}`);
  if (pkgMgrs.length) lines.push(`**Package managers:** ${pkgMgrs.join(', ')}`);
  return lines.join('\n');
};

export const mkFeatures = (architecture: any) => {
  const features = safeArr(
    architecture?.features ||
      architecture?.functionalFeatures ||
      architecture?.insights?.find?.(
        (x: any) => x.type === 'functionalFeatures',
      )?.items ||
      [],
  );
  const nonfunc = safeArr(
    architecture?.nonFunctional ||
      architecture?.insights?.find?.(
        (x: any) => x.type === 'nonFunctionalFeatures',
      )?.items ||
      [],
  );
  const items = take(features, 8);
  const nf = take(nonfunc, 6);
  const out: string[] = [];
  if (items.length) {
    out.push('**Functional:**');
    out.push(fmtList(items));
  }
  if (nf.length) {
    out.push('\n**Non-functional:**');
    out.push(fmtList(nf));
  }
  return out.join('\n');
};

export const mkRoutes = (routes: any) => {
  const list = safeArr(routes?.routes || routes?.endpoints || routes?.items);
  const count = list.length || routes?.count || 0;
  const preview = take(
    list
      .map((r: any) => {
        if (typeof r === 'string') return r;
        const m = r.method || r.http || r.verb;
        const p = r.path || r.route || r.url;
        return [m, p].filter(Boolean).join(' ');
      })
      .filter(Boolean),
    12,
  );
  return count
    ? `Detected **${count}** route(s).\n\nExamples:\n${fmtList(preview)}`
    : 'No routes detected.';
};

export const mkConfig = (config: any) => {
  const bundlers = safeArr(config?.bundlers);
  const builders = safeArr(config?.builders);
  const linters = safeArr(config?.linters);
  const formatters = safeArr(config?.formatters);
  const css = safeArr(config?.cssTools);
  const ts = config?.ts?.enabled
    ? `TypeScript: target=${config.ts.target ?? '?'}, module=${config.ts.module ?? '?'}, strict=${String(!!config.ts.strict)}`
    : 'TypeScript: none';
  const lines = [
    bundlers.length ? `**Bundler:** ${bundlers.join(', ')}` : '',
    builders.length ? `**App builder:** ${builders.join(', ')}` : '',
    linters.length ? `**Linter:** ${linters.join(', ')}` : '',
    formatters.length ? `**Formatter:** ${formatters.join(', ')}` : '',
    css.length ? `**CSS tooling:** ${css.join(', ')}` : '',
    `**${ts}**`,
  ].filter(Boolean);
  return lines.join('\n');
};

export const mkTesting = (tests: any) => {
  const fw = safeArr(tests?.frameworks);
  const run =
    tests?.scripts?.test ||
    tests?.scripts?.['test:unit'] ||
    tests?.scripts?.['test:e2e'];
  const cov = tests?.coverage;
  const covLine = cov?.source
    ? `Coverage: ${cov.source}${typeof cov.linesPct === 'number' ? ` (lines ${cov.linesPct}%)` : ''}`
    : 'Coverage: none';
  return [
    fw.length ? `Frameworks: ${fw.join(', ')}` : 'Frameworks: none',
    run ? `Run: \`${run}\`` : '',
    covLine,
    `Files: ${tests?.locations?.testFiles ?? 0}`,
  ]
    .filter(Boolean)
    .join('\n');
};

export const mkCI = (ci: any) => {
  const prov = safeArr(ci?.providers);
  const wf = safeArr(ci?.files);
  return prov.length
    ? `Providers: ${prov.join(', ')}\nWorkflows: ${wf.slice(0, 8).join(', ')}`
    : 'No CI detected.';
};

export const mkDocs = (docs: any) => {
  const root = docs?.index?.rootReadme;
  const dirs = safeArr(docs?.index?.docsDirs);
  const gens = safeArr(docs?.index?.siteGenerators);
  const topics = docs?.topics || {};
  const presentTopics = Object.entries(topics)
    .filter(([, v]: any) => v.present)
    .map(([k]: any) => k);
  const lines: string[] = [];
  if (root) lines.push(`Root README: \`${root}\``);
  if (dirs.length) lines.push(`Docs dirs: ${dirs.join(', ')}`);
  if (gens.length) lines.push(`Site generators: ${gens.join(', ')}`);
  if (presentTopics.length)
    lines.push(`Covered topics: ${presentTopics.join(', ')}`);
  return lines.length ? lines.join('\n') : 'No docs detected.';
};

export const mkSecurity = (sec: any) => {
  if (!sec) return 'No scan.';
  const risk = Number(sec?.status?.riskScore ?? 0);
  const env = safeArr(sec?.env?.files);
  const tools = [
    ...safeArr(sec?.libs?.security),
    ...safeArr(sec?.libs?.auth),
    ...safeArr(sec?.libs?.crypto),
    ...safeArr(sec?.libs?.scanners),
  ];
  const cors = safeArr(sec?.policies?.corsWildcard);
  const dbg = safeArr(sec?.policies?.debugTrue);
  const keyFiles = safeArr(sec?.sensitiveFiles);
  const lines = [
    `Risk score: ${risk}/100`,
    env.length ? `Env files: ${env.join(', ')}` : '',
    tools.length
      ? `Security tooling: ${take(Array.from(new Set(tools)), 8).join(', ')}`
      : '',
    keyFiles.length ? `Sensitive files: ${take(keyFiles, 6).join(', ')}` : '',
    cors.length ? `CORS wildcard in: ${take(cors, 6).join(', ')}` : '',
    dbg.length ? `DEBUG=true in: ${take(dbg, 6).join(', ')}` : '',
  ].filter(Boolean);
  return lines.join('\n');
};

export const mkGettingStarted = (deps: any) => {
  const mgr = pickPkgMgr(deps);
  const hasDev = mgr.scripts?.dev || mgr.scripts?.start || mgr.scripts?.serve;
  const runStart = mgr.scripts?.dev
    ? mgr.run('dev')
    : mgr.scripts?.start
      ? mgr.run('start')
      : mgr.scripts?.serve
        ? mgr.run('serve')
        : '';
  const lines = [
    '```bash',
    mgr.i,
    runStart ? runStart : '# add your start command',
    '```',
  ];
  return lines.join('\n');
};

export const mkArchitecture = (arch: any) => {
  const summary = arch?.summary || arch?.text || '';
  const comp = arch?.components || [];
  const compList = comp.length
    ? fmtList(
        take(
          comp.map((c: any) =>
            typeof c === 'string' ? c : c.name || JSON.stringify(c),
          ),
          10,
        ),
      )
    : '';
  const mermaid = [
    '```mermaid',
    'flowchart LR',
    '  %% TODO: replace with generated diagram',
    '  A[Client] -->|HTTP| B[API]',
    '  B --> C[Services]',
    '  C --> D[DB]',
    '```',
  ].join('\n');
  return [summary, compList, mermaid].filter(Boolean).join('\n\n');
};

export const assemble = (title: string, sections: Record<string, string>) => {
  const order = [
    'Description',
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
    'License',
    'Contributing',
  ];
  const outline = order.filter((k) => sections[k]);
  const parts = [`# ${title}`];
  for (const k of outline) {
    parts.push(`\n## ${k}\n\n${sections[k]}`);
  }
  return { outline, markdown: parts.join('\n') };
};
