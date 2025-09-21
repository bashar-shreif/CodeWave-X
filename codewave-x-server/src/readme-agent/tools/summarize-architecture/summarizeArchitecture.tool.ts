import { Component } from 'src/readme-agent/types/component.type';
import {
  SummarizeArchitectureInput,
  SummarizeArchitectureOutput,
} from 'src/readme-agent/types/io.type';
import {
  toPosix,
  has,
  anyStartsWith,
  readIfExists,
  scoreToConfidence,
} from './architectureHelpers';

export const summarizeArchitecture = async (
  input: SummarizeArchitectureInput,
): Promise<SummarizeArchitectureOutput> => {
  const { repoRoot, manifest } = input;
  const files = new Set(manifest.map((m) => toPosix(m.path)));
  const components: Component[] = [];
  const entrypoints: string[] = [];
  const configFiles: string[] = [];
  const dataFlowHints: string[] = [];
  let score = 0;

  const stacks = (input.stack?.hits ?? []).map((h) => h.stack.toLowerCase());
  const tools = (input.deps?.tools ?? []).map((t) => t.toLowerCase());
  const langs = Object.keys(input.langProfile?.byLanguage ?? {});

  if (
    has(files, 'artisan') ||
    has(files, 'composer.json') ||
    anyStartsWith(files, ['app/', 'routes/', 'config/'])
  ) {
    const ev: string[] = [];
    if (has(files, 'artisan')) ev.push('artisan');
    if (has(files, 'composer.json')) ev.push('composer.json');
    if (anyStartsWith(files, ['app/'])) ev.push('app/');
    if (anyStartsWith(files, ['routes/'])) ev.push('routes/');
    components.push({
      name: 'Backend',
      path: 'app/',
      tech:
        stacks.includes('laravel') || tools.includes('laravel')
          ? ['Laravel']
          : stacks.includes('django')
            ? ['Django']
            : stacks.includes('flask')
              ? ['Flask']
              : stacks.includes('nestjs')
                ? ['NestJS']
                : stacks.includes('node.js')
                  ? ['Node.js']
                  : undefined,
      notes: ['Controllers, Services, Models'].filter(Boolean),
      evidence: ev,
    });
    score += 3;
    if (has(files, 'public/index.php')) entrypoints.push('public/index.php');
    if (has(files, 'artisan')) entrypoints.push('artisan');
  }

  if (
    has(files, 'src/main.ts') ||
    has(files, 'index.js') ||
    has(files, 'src/index.ts') ||
    has(files, 'src/index.js')
  ) {
    if (!components.some((c) => c.name === 'Backend')) {
      components.push({
        name: 'Backend',
        path: 'src/',
        tech: stacks.includes('nestjs')
          ? ['NestJS']
          : stacks.includes('node.js')
            ? ['Node.js']
            : undefined,
        evidence: [
          'src/main.ts',
          'index.js',
          'src/index.ts',
          'src/index.js',
        ].filter((f) => has(files, f)),
      });
      score += 2;
    }
    ['src/main.ts', 'index.js', 'src/index.ts', 'src/index.js'].forEach(
      (f) => has(files, f) && entrypoints.push(f),
    );
  }

  if (
    has(files, 'manage.py') ||
    has(files, 'app.py') ||
    has(files, 'wsgi.py')
  ) {
    if (!components.some((c) => c.name === 'Backend')) {
      components.push({
        name: 'Backend',
        tech: stacks.includes('django')
          ? ['Django']
          : stacks.includes('flask')
            ? ['Flask']
            : ['Python'],
        evidence: ['manage.py', 'app.py', 'wsgi.py'].filter((f) =>
          has(files, f),
        ),
      });
    }
    ['manage.py', 'app.py', 'wsgi.py'].forEach(
      (f) => has(files, f) && entrypoints.push(f),
    );
    score += 2;
  }

  if (Array.from(files).some((p) => p.endsWith('.csproj'))) {
    if (!components.some((c) => c.name === 'Backend')) {
      components.push({
        name: 'Backend',
        tech: ['ASP.NET'],
        evidence: Array.from(files)
          .filter((p) => p.endsWith('.csproj'))
          .slice(0, 3),
      });
      score += 2;
    }
    if (has(files, 'Program.cs')) entrypoints.push('Program.cs');
  }

  const hasReact = tools.includes('react') || stacks.includes('react');
  const hasNext = stacks.includes('next.js') || tools.includes('next');
  const hasVue = tools.includes('vue') || stacks.includes('vue');
  const frontDirs = [
    'resources/js/',
    'resources/ts/',
    'src/',
    'app/',
    'pages/',
  ];

  if (
    hasNext ||
    hasReact ||
    hasVue ||
    anyStartsWith(files, ['resources/js/', 'resources/ts/'])
  ) {
    const tech: string[] = [];
    if (hasNext) tech.push('Next.js');
    else if (hasReact) tech.push('React');
    if (hasVue) tech.push('Vue');
    const ev = frontDirs.filter((d) => anyStartsWith(files, [d]));
    components.push({
      name: 'Frontend',
      path: ev[0],
      tech: tech.length ? tech : undefined,
      evidence: [
        ...ev,
        ...[
          'vite.config.ts',
          'vite.config.js',
          'next.config.js',
          'angular.json',
          'src/App.tsx',
          'src/App.vue',
          'package.json',
        ].filter((f) => has(files, f)),
      ],
    });
    score += 2;
  }

  const dbNotes: string[] = [];
  const envExample = await readIfExists(repoRoot, '.env.example', files);
  const dbConfigPhp = await readIfExists(
    repoRoot,
    'config/database.php',
    files,
  );

  const hintEnv = (k: string) =>
    envExample && new RegExp('^' + k + '=', 'm').test(envExample);
  if (hintEnv('DB_CONNECTION')) dbNotes.push('.env.example: DB_CONNECTION');
  if (hintEnv('DB_HOST')) dbNotes.push('.env.example: DB_HOST');
  if (dbConfigPhp && /mysql|pgsql|sqlite|sqlsrv/i.test(dbConfigPhp))
    dbNotes.push('config/database.php drivers');
  if (dbNotes.length) {
    components.push({
      name: 'Database',
      tech: undefined,
      notes: ['Relational database configured'],
      evidence: dbNotes,
    });
    score += 1;
  }

  const infra: string[] = [];
  [
    'Dockerfile',
    'docker-compose.yml',
    'Makefile',
    '.github/workflows/',
  ].forEach((f) => {
    if (f.endsWith('/')) {
      if (anyStartsWith(files, [f])) infra.push(f);
    } else if (has(files, f)) infra.push(f);
  });
  if (infra.length) {
    components.push({
      name: 'Infrastructure',
      notes: ['Containerization / CI present'],
      evidence: infra,
    });
    score += 1;
  }

  [
    'composer.json',
    'package.json',
    'requirements.txt',
    'pyproject.toml',
    'pubspec.yaml',
    'angular.json',
    'next.config.js',
    'next.config.ts',
    '.env.example',
    'config/database.php',
    'tsconfig.json',
    'jest.config.js',
    'vite.config.ts',
    'vite.config.js',
    'nest-cli.json',
    'docker-compose.yml',
    'Dockerfile',
  ].forEach((f) => has(files, f) && configFiles.push(f));

  if (components.some((c) => (c.tech || []).includes('Laravel')))
    dataFlowHints.push(
      'HTTP → Routes → Controllers → Services/Jobs → Eloquent/DB',
    );
  if (components.some((c) => (c.tech || []).includes('NestJS')))
    dataFlowHints.push(
      'HTTP → Controllers → Services → Providers/Repositories → DB',
    );
  if (hasNext || hasReact || hasVue)
    dataFlowHints.push('Frontend UI → API calls → Backend endpoints');
  if (!dataFlowHints.length) {
    if (langs.includes('php'))
      dataFlowHints.push('Requests → Controllers → Models → DB');
    if (langs.includes('typescript') || langs.includes('javascript'))
      dataFlowHints.push('HTTP server → Handlers → Data layer');
    if (langs.includes('python'))
      dataFlowHints.push('WSGI/ASGI app → Views → ORM');
  }

  const uniq = Array.from(new Set(entrypoints));

  score += components.length >= 2 ? 2 : 0;
  const confidence = scoreToConfidence(score);

  return {
    components,
    entrypoints: uniq,
    configFiles: Array.from(new Set(configFiles)),
    dataFlowHints: Array.from(new Set(dataFlowHints)),
    confidence,
  };
};
