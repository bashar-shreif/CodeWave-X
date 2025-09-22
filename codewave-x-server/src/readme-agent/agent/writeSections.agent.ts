import { agentConfig } from './config';
import type {
  AgentInput,
  AgentOutput,
  AgentDecisions,
  SectionName,
} from './types';

const cap = (s: string, n = agentConfig.sectionCharCap) =>
  (s || '').trim().slice(0, Math.max(0, n));

const uniq = <T>(a: T[]) => Array.from(new Set(a));
const arr = (v: any): any[] => (Array.isArray(v) ? v : v ? [v] : []);
const topN = (a: string[], n: number) => a.filter(Boolean).slice(0, n);

const pickPkgMgr = (deps: any) => {
  const mgrs = new Set<string>(arr(deps?.pkgManagers || deps?.managers));
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

const redact = (s: string) =>
  s
    .replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED]')
    .replace(/ghp_[A-Za-z0-9]{36}/g, '[REDACTED]')
    .replace(
      /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/g,
      '[REDACTED KEY]',
    )
    .replace(/\b(JWT_SECRET|SECRET_KEY)\b\s*=\s*\S+/g, '$1=[REDACTED]');

const sentence = (s: string) => cap(redact(s)).replace(/\s+/g, ' ').trim();

const mkOverview = (input: AgentInput) => {
  const name = input.projectName || 'This project';
  const desc = input.descriptionHint ? `${name} ${input.descriptionHint}.` : '';
  const langs = Object.entries(input.langProfile?.languages || {})
    .sort((a: any, b: any) => (b[1] as number) - (a[1] as number))
    .map(([k]) => String(k));
  const fw = arr(input.stack?.frameworks || input.stack?.detected);
  const feats = arr(
    input.architecture?.features || input.architecture?.functionalFeatures,
  ).slice(0, 3);
  const lines: string[] = [];
  if (desc) lines.push(sentence(desc));
  if (fw.length || langs.length) {
    const tech = [
      fw.length ? `It uses ${topN(fw, 3).join(', ')}` : '',
      langs.length
        ? `with ${topN(langs, 3).join(', ')} as primary language(s)`
        : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (tech) lines.push(sentence(tech + '.'));
  }
  if (feats.length)
    lines.push(sentence(`Core capabilities include ${feats.join(', ')}.`));
  return cap(lines.join(' '));
};

const mkTechStack = (input: AgentInput) => {
  const langs = Object.entries(input.langProfile?.languages || {})
    .sort((a: any, b: any) => (b[1] as number) - (a[1] as number))
    .map(([k]) => String(k));
  const fw = arr(input.stack?.frameworks || input.stack?.detected);
  const mgrs = arr(input.deps?.pkgManagers || input.deps?.managers);
  const bits: string[] = [];
  if (langs.length) bits.push(`Languages: ${topN(langs, 6).join(', ')}`);
  if (fw.length) bits.push(`Frameworks: ${topN(fw, 6).join(', ')}`);
  if (mgrs.length) bits.push(`Package managers: ${topN(mgrs, 3).join(', ')}`);
  return bits.length ? bits.join('\n') : '';
};

const mkArchitecture = (input: AgentInput) => {
  const comp = arr(input.architecture?.components)
    .map((c: any) => (typeof c === 'string' ? c : c?.name))
    .filter(Boolean);
  const sum = input.architecture?.summary || input.architecture?.text || '';
  const parts: string[] = [];
  if (sum) parts.push(sentence(sum));
  if (comp.length) parts.push(`Key components: ${topN(comp, 8).join(', ')}.`);
  return cap(parts.join(' '));
};

const mkGettingStarted = (deps: any) => {
  const mgr = pickPkgMgr(deps);
  const runStart = mgr.scripts?.dev
    ? mgr.run('dev')
    : mgr.scripts?.start
      ? mgr.run('start')
      : mgr.scripts?.serve
        ? mgr.run('serve')
        : '';
  return ['```bash', mgr.i, runStart || '# add your start command', '```'].join(
    '\n',
  );
};

const mkRoutes = (routes: any) => {
  const list = arr(routes?.routes || routes?.items);
  const count = list.length || routes?.count || 0;
  if (!count) return '';
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
      ? `Covered topics: ${topN(presentTopics, 6).join(', ')}.`
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

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;

export const writeSectionsAgent = async (
  input: AgentInput,
): Promise<AgentOutput> => {
  const t0 = Date.now();

  const sections: Partial<Record<SectionName, string>> = {};

  // prose sections
  const overview = mkOverview(input);
  if (nonEmpty(overview)) sections['Overview'] = overview;

  const arch = mkArchitecture(input);
  if (nonEmpty(arch)) sections['Architecture'] = arch;

  const features = arr(
    input.architecture?.features || input.architecture?.functionalFeatures,
  );
  if (features.length)
    sections['Features'] = cap(
      `Key features: ${topN(features, 8).join(', ')}.`,
    );

  const docs = mkDocs(input.docs);
  if (nonEmpty(docs)) sections['Documentation'] = docs;

  const sec = mkSecurity(input.security);
  if (nonEmpty(sec)) sections['Security'] = sec;

  const test = mkTesting(input.tests, input.deps);
  if (nonEmpty(test)) sections['Testing'] = test;

  // structured sections
  const tech = mkTechStack(input);
  if (nonEmpty(tech)) sections['Tech Stack'] = tech;

  const cfg = mkConfig(input.config);
  if (nonEmpty(cfg)) sections['Configuration'] = cfg;

  const routes = mkRoutes(input.routes);
  if (nonEmpty(routes)) sections['Routes'] = routes;

  const ci = mkCI(input.ci);
  if (nonEmpty(ci)) sections['CI'] = ci;

  sections['Getting Started'] = mkGettingStarted(input.deps);

  // optional sections from docs topics
  if (input.docs?.topics?.license?.present)
    sections['License'] = 'See `LICENSE`.';
  if (input.docs?.topics?.contributing?.present)
    sections['Contributing'] = 'See `CONTRIBUTING.md`.';

  // decisions
  const presentCount = Object.keys(sections).length;
  const decisions: AgentDecisions = {
    preferBadges: true,
    addTOC: presentCount >= 3,
    removedSections: [] as SectionName[],
  };

  // enforce caps and banned phrases
  for (const k of Object.keys(sections) as SectionName[]) {
    const v = sections[k] || '';
    const bannedHit = agentConfig.bannedPhrases.some((rx) => rx.test(v));
    sections[k] = cap(bannedHit ? v.replace(/probably|guess/gi, '').trim() : v);
    if (!nonEmpty(sections[k])) delete sections[k];
  }

  return {
    sections: sections as Record<SectionName, string>,
    decisions,
    timings: { totalMs: Date.now() - t0, useLLM: 0 },
  };
};
