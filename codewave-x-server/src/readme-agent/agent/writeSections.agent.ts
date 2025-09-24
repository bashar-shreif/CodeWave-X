import { agentConfig } from './config';
import type {
  AgentInput,
  AgentOutput,
  AgentDecisions,
  SectionName,
} from './types';

const titleize = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const arr = (v: any): any[] => (Array.isArray(v) ? v : v ? [v] : []);
const uniq = <T>(a: T[]) => Array.from(new Set(a));
const cap = (s: string, n = agentConfig.sectionCharCap) =>
  (s || '').trim().slice(0, Math.max(0, n));
const topN = (a: string[], n: number) => a.filter(Boolean).slice(0, n);
const sentence = (s: string) => cap(s).replace(/\s+/g, ' ').trim();

const getFrameworks = (input: AgentInput): string[] => {
  const fromStack = arr(input.stack?.frameworks)
    .concat(arr(input.stack?.detected))
    .concat(arr(input.stack?.hits).map((h: any) => h?.stack));
  const fromRoutes = arr((input as any).routes?.frameworksDetected);
  const fromArch = arr(input.architecture?.components).flatMap((c: any) =>
    arr(c?.tech),
  );
  return uniq(
    fromStack
      .concat(fromRoutes, fromArch)
      .filter(Boolean)
      .map((s: string) => titleize(String(s))),
  );
};

const langDist = (lp: any) => {
  if (!lp) return [] as { name: string; pct: number; files?: number }[];
  const entries: { name: string; loc: number; files?: number }[] = [];

  if (lp.languages && typeof lp.languages === 'object') {
    for (const [name, v] of Object.entries(lp.languages)) {
      const loc =
        typeof v === 'number' ? v : ((v as any)?.lines ?? (v as any)?.loc ?? 0);
      const files = typeof v === 'object' ? ((v as any)?.files ?? 0) : 0;
      entries.push({ name, loc, files });
    }
  } else if (lp.byLanguage && typeof lp.byLanguage === 'object') {
    for (const [name, v] of Object.entries(lp.byLanguage)) {
      const loc = (v as any)?.loc ?? 0;
      const files = (v as any)?.files ?? 0;
      entries.push({ name, loc, files });
    }
  }

  const total =
    lp.totals?.loc ?? (entries.reduce((a, b) => a + (b.loc || 0), 0) || 0);
  return entries
    .sort((a, b) => (b.loc || 0) - (a.loc || 0))
    .map((e) => ({
      name: e.name,
      pct: total ? Math.round((100 * (e.loc || 0)) / total) : 0,
      files: e.files,
    }))
    .filter((e) => e.pct > 0);
};

const mkOverview = (input: AgentInput) => {
  const name = input.projectName || 'This project';
  const fw = getFrameworks(input);
  const langs = langDist(input.langProfile).map((x) => x.name);
  const feats = arr(
    input.architecture?.features || input.architecture?.functionalFeatures,
  ).slice(0, 4);
  const bits = [
    input.descriptionHint ? sentence(`${name} ${input.descriptionHint}.`) : '',
    fw.length ? `Uses ${topN(fw, 3).join(', ')}.` : '',
    langs.length ? `Primary languages: ${topN(langs, 3).join(', ')}.` : '',
    feats.length ? `Core capabilities: ${feats.join(', ')}.` : '',
  ].filter(Boolean);
  return cap(bits.join(' '));
};

const mkTechStack = (input: AgentInput) => {
  const langs = langDist(input.langProfile);
  const fw = getFrameworks(input);
  const mgrs = arr(
    input.deps?.pkgManagers ||
      input.deps?.managers ||
      (input.deps?.composer ? ['composer'] : []),
  );
  const bits: string[] = [];
  if (langs.length)
    bits.push(
      `Languages: ${langs
        .slice(0, 6)
        .map((x) => `${x.name} ${x.pct}%`)
        .join(', ')}`,
    );
  if (fw.length) bits.push(`Frameworks: ${topN(fw, 6).join(', ')}`);
  if (mgrs.length) bits.push(`Package managers: ${topN(mgrs, 3).join(', ')}`);
  return bits.join('\n');
};

const mkDependencies = (deps: any) => {
  if (!deps) return '';
  const toPair = (x: any): { name: string; version?: string } => {
    if (typeof x === 'string') {
      const m = x.match(/^(@?[^@]+)@(.+)$/);
      return m ? { name: m[1], version: m[2] } : { name: x };
    }
    if (x && typeof x === 'object' && x.name)
      return { name: x.name, version: x.version };
    return { name: String(x) };
  };

  const runtime: { name: string; version?: string }[] = Array.isArray(
    deps.runtime,
  )
    ? deps.runtime.map(toPair)
    : deps.dependencies
      ? Object.entries(deps.dependencies).map(([name, version]: any) => ({
          name,
          version: String(version),
        }))
      : [];

  const dev: { name: string; version?: string }[] = Array.isArray(deps.dev)
    ? deps.dev.map(toPair)
    : deps.devDependencies
      ? Object.entries(deps.devDependencies).map(([name, version]: any) => ({
          name,
          version: String(version),
        }))
      : [];

  const fmt = (p: { name: string; version?: string }) =>
    `- ${p.name}${p.version ? ` @ ${p.version}` : ''}`;

  const lines: string[] = [];
  if (runtime.length) {
    lines.push('Key runtime dependencies:');
    lines.push(...runtime.slice(0, 12).map(fmt));
  }
  if (dev.length) {
    if (lines.length) lines.push(''); // spacer
    lines.push('Key dev dependencies:');
    lines.push(...dev.slice(0, 8).map(fmt));
  }
  if (!lines.length) return '';
  return lines.join('\n');
};

const mkArchitecture = (input: AgentInput) => {
  const comp = arr(input.architecture?.components)
    .map((c: any) => (typeof c === 'string' ? c : c?.name))
    .filter(Boolean);
  const sum = input.architecture?.summary || input.architecture?.text || '';
  const bits = [
    sum ? sentence(sum) : '',
    comp.length ? `Key components: ${topN(comp, 10).join(', ')}.` : '',
  ].filter(Boolean);
  return cap(bits.join(' '));
};

const mkDiagrams = (input: AgentInput) => {
  const fw = arr(input.stack?.frameworks || input.stack?.detected);
  const title = fw.includes('Laravel') ? 'Laravel Service' : 'Service';
  const mermaid = `\`\`\`mermaid
flowchart LR
  Client[[Client]]
  API[${title}]
  DB[(Database)]
  Client -->|HTTP| API
  API --> DB
\`\`\``;
  const structure = `Suggested structure diagram (replace with your own):

\`\`\`mermaid
flowchart TB
  src --> controllers
  src --> services
  src --> repositories
  src --> entities
  src --> config
\`\`\``;
  return `${mermaid}\n\n${structure}`;
};

const pickPkgMgr = (deps: any) => {
  const mgrs = new Set<string>(arr(deps?.pkgManagers || deps?.managers));
  const scripts = deps?.scripts || {};
  if (
    mgrs.has('composer') ||
    deps?.composer ||
    arr(deps?.runtime).some(
      (x: any) => typeof x === 'string' && x.includes('/'),
    )
  ) {
    return {
      name: 'composer',
      i: 'composer install',
      run: (s: string) => `composer ${s}`,
      scripts,
    };
  }
  if (mgrs.has('pnpm'))
    return {
      name: 'pnpm',
      i: 'pnpm i',
      run: (s: string) => `pnpm ${s}`,
      scripts,
    };
  if (mgrs.has('yarn'))
    return {
      name: 'yarn',
      i: 'yarn',
      run: (s: string) => `yarn ${s}`,
      scripts,
    };
  return {
    name: 'npm',
    i: 'npm ci',
    run: (s: string) => `npm run ${s}`,
    scripts,
  };
};

const mkGettingStarted = (input: AgentInput) => {
  const mgr = pickPkgMgr(input.deps);
  const isLaravel = getFrameworks(input).includes('Laravel');
  if (mgr.name === 'composer' || isLaravel) {
    return [
      '```bash',
      'composer install',
      'cp .env.example .env',
      'php artisan key:generate',
      'php artisan migrate --seed # optional',
      'php artisan serve',
      '```',
    ].join('\n');
  }
  const s = mgr.scripts || {};
  const runStart = s.dev
    ? mgr.run('dev')
    : s.start
      ? mgr.run('start')
      : s.serve
        ? mgr.run('serve')
        : '# add your start command';
  return ['```bash', mgr.i, runStart, '```'].join('\n');
};

const mkRoutes = (routes: any) => {
  const list = arr(routes?.routes || routes?.items);
  const count = list.length || routes?.count || 0;
  if (!count) return '';
  const byMethod: Record<string, number> = {};
  list.forEach((r: any) => {
    const m = (r.method || r.http || r.verb || '').toUpperCase();
    if (!m) return;
    byMethod[m] = (byMethod[m] || 0) + 1;
  });
  const meth = Object.entries(byMethod)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, v]) => `${k}: ${v}`);
  const preview = topN(
    list.map((r: any) =>
      [r.method || r.http || r.verb, r.path || r.route || r.url]
        .filter(Boolean)
        .join(' '),
    ),
    8,
  );
  const lines = [
    `Detected ${count} route(s).`,
    meth.length ? `Methods: ${meth.join(', ')}.` : '',
    preview.length ? `Examples:\n- ${preview.join('\n- ')}` : '',
  ];
  return cap(lines.filter(Boolean).join('\n'));
};

const mkConfig = (cfg: any) => {
  const bundlers = arr(cfg?.bundlers);
  const builders = arr(cfg?.builders);
  const linters = arr(cfg?.linters);
  const formatters = arr(cfg?.formatters);
  const css = arr(cfg?.cssTools);
  const ts = cfg?.ts?.enabled
    ? `TypeScript enabled (target=${cfg?.ts?.target ?? '?'}, module=${cfg?.ts?.module ?? '?'}, strict=${!!cfg?.ts?.strict}).`
    : '';
  const bits = [
    bundlers.length ? `Bundler: ${bundlers.join(', ')}.` : '',
    builders.length ? `App builder: ${builders.join(', ')}.` : '',
    linters.length ? `Linter: ${linters.join(', ')}.` : '',
    formatters.length ? `Formatter: ${formatters.join(', ')}.` : '',
    css.length ? `CSS tooling: ${css.join(', ')}.` : '',
    ts,
  ].filter(Boolean);
  return cap(bits.join(' '));
};

const mkTesting = (tests: any, deps: any) => {
  const fw = arr(tests?.frameworks);
  const scripts = deps?.scripts || {};
  const run = scripts.test || scripts['test:unit'] || scripts['test:e2e'] || '';
  const cov = tests?.coverage;
  const covLine = cov?.source
    ? `Coverage from ${cov.source}${typeof cov.linesPct === 'number' ? `, lines ${cov.linesPct}%` : ''}.`
    : '';
  const parts = [
    fw.length ? `Testing with ${topN(fw, 4).join(', ')}.` : '',
    run ? `Run tests with \`${run}\`.` : '',
    covLine,
  ].filter(Boolean);
  return cap(parts.join(' '));
};

const mkCI = (ci: any) => {
  const prov = arr(ci?.providers);
  const files = arr(ci?.files);
  if (!prov.length && !files.length) return '';
  return cap(
    [
      prov.length ? `CI providers: ${topN(prov, 4).join(', ')}.` : '',
      files.length ? `Workflows: ${topN(files, 6).join(', ')}.` : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
};

const mkDocs = (docs: any) => {
  const root = docs?.index?.rootReadme;
  const dirs = arr(docs?.index?.docsDirs);
  const gens = arr(docs?.index?.siteGenerators);
  const topics = docs?.topics || {};
  const presentTopics = Object.entries(topics)
    .filter(([, v]: any) => v?.present)
    .map(([k]: any) => k);
  const bits = [
    root ? `Root README at \`${root}\`.` : '',
    dirs.length ? `Docs directories: ${dirs.join(', ')}.` : '',
    gens.length ? `Site generators: ${gens.join(', ')}.` : '',
    presentTopics.length
      ? `Covered topics: ${topN(presentTopics, 8).join(', ')}.`
      : '',
  ].filter(Boolean);
  return cap(bits.join(' '));
};

const mkSecurity = (sec: any) => {
  if (!sec) return '';
  const risk = Number(sec?.status?.riskScore ?? 0);
  const tools = uniq([
    ...arr(sec?.libs?.security),
    ...arr(sec?.libs?.auth),
    ...arr(sec?.libs?.crypto),
    ...arr(sec?.libs?.scanners),
  ]);
  const env = arr(sec?.env?.files);
  const keyFiles = arr(sec?.sensitiveFiles);
  const cors = arr(sec?.policies?.corsWildcard);
  const dbg = arr(sec?.policies?.debugTrue);
  const bits = [
    `Risk score ${risk}/100.`,
    tools.length ? `Security tooling: ${topN(tools, 8).join(', ')}.` : '',
    env.length ? `Env files present.` : '',
    keyFiles.length ? `Sensitive key/cert files detected.` : '',
    cors.length ? `CORS wildcard configured in ${cors.length} file(s).` : '',
    dbg.length ? `Debug mode enabled in ${dbg.length} file(s).` : '',
  ].filter(Boolean);
  return cap(bits.join(' '));
};

const mkScripts = (deps: any) => {
  const scripts = deps?.scripts || {};
  const keys = Object.keys(scripts).slice(0, 12);
  if (!keys.length) return '';
  return [
    'Common scripts:',
    ...keys.map((k) => `- ${k}: \`${scripts[k]}\``),
  ].join('\n');
};

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;

export const writeSectionsAgent = async (
  input: AgentInput,
): Promise<AgentOutput> => {
  const sections: Partial<Record<SectionName, string>> = {};

  const overview = mkOverview(input);
  if (nonEmpty(overview)) sections['Overview'] = overview;

  const tech = mkTechStack(input);
  if (nonEmpty(tech)) sections['Tech Stack'] = tech;

  const deps = mkDependencies(input.deps);
  if (nonEmpty(deps)) sections['Dependencies'] = deps;

  const arch = mkArchitecture(input);
  if (nonEmpty(arch)) sections['Architecture'] = arch;

  const diagrams = mkDiagrams(input);
  if (nonEmpty(diagrams)) sections['Diagrams'] = diagrams;

  sections['Getting Started'] = mkGettingStarted(input);

  const routes = mkRoutes(input.routes);
  if (nonEmpty(routes)) sections['Routes'] = routes;

  const cfg = mkConfig(input.config);
  if (nonEmpty(cfg)) sections['Configuration'] = cfg;

  const test = mkTesting(input.tests, input.deps);
  if (nonEmpty(test)) sections['Testing'] = test;

  const ci = mkCI(input.ci);
  if (nonEmpty(ci)) sections['CI'] = ci;

  const docs = mkDocs(input.docs);
  if (nonEmpty(docs)) sections['Documentation'] = docs;

  const sec = mkSecurity(input.security);
  if (nonEmpty(sec)) sections['Security'] = sec;

  const scripts = mkScripts(input.deps);
  if (nonEmpty(scripts)) sections['Scripts'] = scripts;

  if (input.docs?.topics?.contributing?.present)
    sections['Contributing'] = 'See `CONTRIBUTING.md`.';
  if (input.docs?.topics?.license?.present)
    sections['License'] = 'See `LICENSE`.';

  const presentCount = Object.keys(sections).length;
  const decisions: AgentDecisions = {
    preferBadges: true,
    addTOC: presentCount >= 3,
    removedSections: [] as SectionName[],
  };

  // redaction + caps
  const banned = agentConfig.bannedPhrases || [];
  for (const k of Object.keys(sections) as SectionName[]) {
    let v = sections[k] || '';
    if (banned.length) for (const rx of banned) v = v.replace(rx, '');
    sections[k] = cap(v);
    if (!nonEmpty(sections[k])) delete sections[k];
  }

  return {
    sections: sections as Record<SectionName, string>,
    decisions,
    timings: { totalMs: 0, useLLM: 0 },
  };
};
