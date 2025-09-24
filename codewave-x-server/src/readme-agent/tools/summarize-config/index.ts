import path from 'path';
import { SummarizeConfigOutput } from '../../types/tools/io.type';
import { pathExists, readJson, rel, walk } from './helpers';

export const summarizeConfig = async (
  repoRoot: string,
): Promise<SummarizeConfigOutput> => {
  const files = await walk(repoRoot);
  const configsFound = new Set<string>();
  const bundlers = new Set<string>();
  const builders = new Set<string>();
  const linters = new Set<string>();
  const formatters = new Set<string>();
  const cssTools = new Set<string>();
  const monoManagers = new Set<string>();
  const notes: string[] = [];

  // Presence by filename
  const hasName = (n: string) =>
    files.some((f) => path.basename(f).toLowerCase() === n.toLowerCase());
  const hasAny = (pred: (bn: string) => boolean) =>
    files.some((f) => pred(path.basename(f).toLowerCase()));

  // Bundlers/build tools presence
  if (hasAny((n) => /^vite\.config\.(js|cjs|mjs|ts)$/.test(n))) {
    bundlers.add('Vite');
    files
      .filter((f) => /vite\.config\./i.test(path.basename(f)))
      .forEach((f) => configsFound.add(rel(repoRoot, f)));
  }
  if (hasAny((n) => /^webpack(\.config)?\.(js|cjs|mjs|ts)$/.test(n))) {
    bundlers.add('Webpack');
    files
      .filter((f) => /webpack/i.test(path.basename(f)))
      .forEach((f) => configsFound.add(rel(repoRoot, f)));
  }
  if (hasAny((n) => /^rollup\.config\.(js|cjs|mjs|ts)$/.test(n))) {
    bundlers.add('Rollup');
    files
      .filter((f) => /rollup\.config\./i.test(path.basename(f)))
      .forEach((f) => configsFound.add(rel(repoRoot, f)));
  }
  if (hasAny((n) => /^esbuild\.(js|cjs|mjs|ts)$/.test(n))) {
    bundlers.add('esbuild');
    files
      .filter((f) => /^esbuild\./i.test(path.basename(f)))
      .forEach((f) => configsFound.add(rel(repoRoot, f)));
  }
  if (hasAny((n) => /^tsup\.config\.(ts|js|cjs|mjs)$/.test(n))) {
    bundlers.add('tsup');
    files
      .filter((f) => /tsup\.config\./i.test(path.basename(f)))
      .forEach((f) => configsFound.add(rel(repoRoot, f)));
  }

  // Framework builders
  if (hasAny((n) => /^next\.config\.(js|cjs|mjs|ts)$/.test(n))) {
    builders.add('Next.js');
    files
      .filter((f) => /next\.config\./i.test(path.basename(f)))
      .forEach((f) => configsFound.add(rel(repoRoot, f)));
  }
  if (hasAny((n) => /^nuxt\.config\.(js|cjs|mjs|ts)$/.test(n))) {
    builders.add('Nuxt');
    files
      .filter((f) => /nuxt\.config\./i.test(path.basename(f)))
      .forEach((f) => configsFound.add(rel(repoRoot, f)));
  }
  if (hasName('angular.json')) {
    builders.add('Angular');
    configsFound.add('angular.json');
  }
  if (hasAny((n) => /^svelte\.config\.(js|ts)$/.test(n))) {
    builders.add('SvelteKit');
    files
      .filter((f) => /svelte\.config\./i.test(path.basename(f)))
      .forEach((f) => configsFound.add(rel(repoRoot, f)));
  }
  if (hasAny((n) => /^astro\.config\.(ts|js|mjs|cjs)$/.test(n))) {
    builders.add('Astro');
    files
      .filter((f) => /astro\.config\./i.test(path.basename(f)))
      .forEach((f) => configsFound.add(rel(repoRoot, f)));
  }

  // CSS toolchain
  if (hasAny((n) => /^tailwind\.config\.(ts|js|cjs|mjs)$/.test(n))) {
    cssTools.add('TailwindCSS');
    files
      .filter((f) => /tailwind\.config\./i.test(path.basename(f)))
      .forEach((f) => configsFound.add(rel(repoRoot, f)));
  }
  if (hasAny((n) => /^postcss\.config\.(ts|js|cjs|mjs)$/.test(n))) {
    cssTools.add('PostCSS');
    files
      .filter((f) => /postcss\.config\./i.test(path.basename(f)))
      .forEach((f) => configsFound.add(rel(repoRoot, f)));
  }

  // ESLint
  const eslintPaths: string[] = [];
  const eslintCandidates = [
    '.eslintrc.json',
    '.eslintrc.cjs',
    '.eslintrc.js',
    '.eslintrc.yaml',
    '.eslintrc.yml',
    'eslint.config.js',
    'eslint.config.cjs',
    'eslint.config.mjs',
    'eslint.config.ts',
  ];
  for (const c of eslintCandidates) {
    const abs = path.join(repoRoot, c);
    if (await pathExists(abs)) {
      linters.add('ESLint');
      eslintPaths.push(c);
      configsFound.add(c);
    }
  }

  // Prettier
  const prettierPaths: string[] = [];
  const prettierCandidates = [
    '.prettierrc',
    '.prettierrc.json',
    '.prettierrc.yaml',
    '.prettierrc.yml',
    '.prettierrc.js',
    '.prettierrc.cjs',
    'prettier.config.js',
    'prettier.config.cjs',
    'prettier.config.mjs',
    'prettier.config.ts',
  ];
  for (const c of prettierCandidates) {
    const abs = path.join(repoRoot, c);
    if (await pathExists(abs)) {
      formatters.add('Prettier');
      prettierPaths.push(c);
      configsFound.add(c);
    }
  }

  // TypeScript tsconfig
  const ts: SummarizeConfigOutput['ts'] = { enabled: false };
  const tsConfigPaths = [
    'tsconfig.json',
    'tsconfig.base.json',
    'tsconfig.app.json',
    'tsconfig.build.json',
  ];
  for (const c of tsConfigPaths) {
    const abs = path.join(repoRoot, c);
    if (await pathExists(abs)) {
      const cfg = await readJson<any>(abs);
      if (cfg && typeof cfg === 'object') {
        ts.enabled = true;
        ts.tsconfigPath = c;
        ts.target = cfg.compilerOptions?.target;
        ts.module = cfg.compilerOptions?.module;
        ts.jsx = cfg.compilerOptions?.jsx;
        ts.strict = cfg.compilerOptions?.strict;
        ts.paths = cfg.compilerOptions?.paths;
        configsFound.add(c);
        break;
      }
    }
  }

  // Monorepo indicators
  if (await pathExists(path.join(repoRoot, 'turbo.json'))) {
    monoManagers.add('Turborepo');
    configsFound.add('turbo.json');
  }
  if (await pathExists(path.join(repoRoot, 'nx.json'))) {
    monoManagers.add('Nx');
    configsFound.add('nx.json');
  }
  if (await pathExists(path.join(repoRoot, 'lerna.json'))) {
    monoManagers.add('Lerna');
    configsFound.add('lerna.json');
  }
  if (
    (await pathExists(path.join(repoRoot, 'pnpm-workspace.yaml'))) ||
    (await pathExists(path.join(repoRoot, 'pnpm-workspace.yml')))
  ) {
    monoManagers.add('pnpm workspaces');
    configsFound.add(
      (await pathExists(path.join(repoRoot, 'pnpm-workspace.yaml')))
        ? 'pnpm-workspace.yaml'
        : 'pnpm-workspace.yml',
    );
  }

  // package.json signals: workspaces, scripts calling tools
  const pkg = await readJson<any>(path.join(repoRoot, 'package.json'));
  if (pkg) {
    // workspaces
    const ws = pkg.workspaces;
    if (Array.isArray(ws)) {
      monoManagers.add('Yarn/NPM workspaces');
    }
    if (ws && Array.isArray(ws.packages)) {
      monoManagers.add('Yarn/NPM workspaces');
    }
    // scripts heuristic
    const scripts = pkg.scripts || {};
    const hasScript = (r: RegExp) =>
      Object.values<string>(scripts).some((v) => r.test(v));
    if (hasScript(/\bwebpack\b/)) bundlers.add('Webpack');
    if (hasScript(/\b(vite|vite build)\b/)) bundlers.add('Vite');
    if (hasScript(/\brollup\b/)) bundlers.add('Rollup');
    if (hasScript(/\besbuild\b/)) bundlers.add('esbuild');
    if (hasScript(/\btsup\b/)) bundlers.add('tsup');
    if (hasScript(/\beslint\b/)) linters.add('ESLint');
    if (hasScript(/\bprettier\b/)) formatters.add('Prettier');
    if (hasScript(/\bnext\b/)) builders.add('Next.js');
    if (hasScript(/\bnuxt\b/)) builders.add('Nuxt');
    if (hasScript(/\bastro\b/)) builders.add('Astro');
    if (hasScript(/\bsvelte-kit\b|\bvite svelte\b/)) builders.add('SvelteKit');
  }

  // Mono report
  const mono: SummarizeConfigOutput['monoRepo'] = {
    managers: [...monoManagers].sort(),
    workspaces: Boolean(pkg?.workspaces),
    workspaceGlobs: Array.isArray(pkg?.workspaces)
      ? pkg.workspaces
      : pkg?.workspaces?.packages && Array.isArray(pkg.workspaces.packages)
        ? pkg.workspaces.packages
        : undefined,
  };

  if (bundlers.size === 0 && builders.size === 0)
    notes.push('No bundler or app builder config detected');
  if (!ts.enabled) notes.push('No tsconfig found');
  if (linters.size === 0) notes.push('No ESLint config found');
  if (formatters.size === 0) notes.push('No Prettier config found');

  return {
    bundlers: [...bundlers].sort(),
    builders: [...builders].sort(),
    linters: [...linters].sort(),
    formatters: [...formatters].sort(),
    cssTools: [...cssTools].sort(),
    monoRepo: mono,
    ts,
    eslint: { present: linters.size > 0, configPaths: eslintPaths.sort() },
    prettier: {
      present: formatters.size > 0,
      configPaths: prettierPaths.sort(),
    },
    configsFound: [...configsFound].sort(),
    notes,
  };
};

export default summarizeConfig;
