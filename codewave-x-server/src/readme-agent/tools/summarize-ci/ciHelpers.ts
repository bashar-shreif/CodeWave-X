import fs from 'fs/promises';
import path from 'path';
import { CIWorkflow } from 'src/readme-agent/types/ciWorkflow.type';

export const readText = async (p: string) => {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return null;
  }
};

export const pathExists = async (p: string) => {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
};

export const walk = async (root: string): Promise<string[]> => {
  const out: string[] = [];
  const stack = [root];
  const skip = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    '.next',
    '.nuxt',
    '.turbo',
    '.cache',
    '.venv',
    'venv',
    '.pnpm-store',
    '.gradle',
    '.m2',
  ]);
  while (stack.length) {
    const cur = stack.pop()!;
    const ents = await fs.readdir(cur, { withFileTypes: true });
    for (const e of ents) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (!skip.has(e.name)) stack.push(full);
      } else out.push(full);
    }
  }
  return out;
};

export const rel = (root: string, p: string) => path.relative(root, p);

export const rxAny = (s: string, patterns: RegExp[]) =>
  patterns.some((r) => r.test(s));

export const uniqPush = (
  set: Set<string>,
  arr: (string | undefined | null)[],
) => {
  for (const v of arr) if (v) set.add(v);
};

export const extractBetween = (s: string, start: number, max = 4000) =>
  s.slice(start, Math.min(s.length, start + max));

export const analyzeYamlText = (
  provider: CIWorkflow['provider'],
  text: string,
): Omit<CIWorkflow, 'path' | 'provider'> => {
  const lower = text.toLowerCase();
  const triggers = new Set<string>();
  const steps = new Set<string>();
  const matrix = new Set<string>();
  let jobsCount: number | undefined;

  // triggers
  if (provider === 'GitHub Actions') {
    if (/^\s*on:\s*$/m.test(text) || /\bon:\s*[{[]/m.test(text))
      triggers.add('on:*');
    if (/\bon:\s*[^#\n]*push\b/m.test(text) || /\bpush:\b/m.test(text))
      triggers.add('push');
    if (/\bpull_request\b/m.test(text)) triggers.add('pull_request');
    if (/\bschedule:\b/m.test(text)) triggers.add('schedule');
    if (/\brelease:\b/m.test(text)) triggers.add('release');
    if (/\bworkflow_dispatch\b/m.test(text)) triggers.add('manual');
  } else if (provider === 'GitLab CI') {
    if (/\bonly:\b/m.test(text)) triggers.add('only');
    if (/\bexcept:\b/m.test(text)) triggers.add('except');
    if (/\brules:\b/m.test(text)) triggers.add('rules');
    if (/\bschedule\b/m.test(text)) triggers.add('schedule');
  } else if (provider === 'CircleCI') {
    if (/\bworkflows:\b/m.test(text)) triggers.add('workflows');
    if (/\bschedule\b/m.test(text)) triggers.add('schedule');
  } else if (provider === 'Travis CI') {
    if (/\bbranches:\b/m.test(text)) triggers.add('branches');
    if (/\bcron\b/m.test(text)) triggers.add('cron');
  } else if (provider === 'Azure Pipelines') {
    if (/\btrigger:\b/m.test(text)) triggers.add('trigger');
    if (/\bpr:\b/m.test(text)) triggers.add('pr');
    if (/\bschedules:\b/m.test(text)) triggers.add('schedules');
  } else if (provider === 'Jenkins') {
    if (/pipeline\s*{/.test(text)) triggers.add('pipeline');
    if (/cron\(/i.test(text)) triggers.add('cron');
  }

  // job count (rough)
  if (provider === 'GitHub Actions') {
    const m = text.match(/\bjobs:\s*([\s\S]+)/);
    if (m) {
      const body = extractBetween(m[1], 0);
      const keys = body.match(/^\s{2,}([A-Za-z0-9_\-]+):/gm);
      if (keys)
        jobsCount = new Set(keys.map((k) => k.trim().replace(/:$/, ''))).size;
    }
  } else if (provider === 'GitLab CI') {
    const jobs = text.match(/^[a-zA-Z0-9_\-]+:\s*\n\s*stage:/gm);
    if (jobs) jobsCount = jobs.length;
  } else if (provider === 'CircleCI') {
    const jobs = text.match(/\bjobs:\s*\n([\s\S]+?)\n\S/);
    if (jobs) {
      const keys = jobs[1].match(/^\s{2,}([A-Za-z0-9_\-]+):/gm);
      if (keys)
        jobsCount = new Set(keys.map((k) => k.trim().replace(/:$/, ''))).size;
    }
  }

  // step categories by common commands
  const cat = (label: string, re: RegExp) => {
    if (re.test(lower)) steps.add(label);
  };
  cat(
    'install',
    /\b(npm ci|npm install|pnpm i(?!nstall:if-present)|yarn install|pip install|poetry install|composer install|bundle install)\b/,
  );
  cat(
    'build',
    /\b(npm run build|yarn build|pnpm build|vite build|rollup -c|webpack|go build|dotnet build|mvn package|gradle build)\b/,
  );
  cat(
    'test',
    /\b(npm test|yarn test|pnpm test|jest|vitest|mocha|ava|pytest|phpunit|go test|dotnet test|mvn test|gradle test)\b/,
  );
  cat(
    'lint',
    /\b(eslint|npm run lint|yarn lint|pnpm lint|flake8|ruff|pylint)\b/,
  );
  cat('format', /\b(prettier|npm run format|yarn format|pnpm format)\b/);
  cat(
    'coverage',
    /\b(nyc|c8|jest --coverage|coverage\.py|lcov|codecov|coveralls)\b/,
  );
  cat('docker', /\b(docker build|docker compose|buildx|kaniko)\b/);
  cat(
    'deploy',
    /\b(vercel|netlify|firebase|aws s3|aws ecr|ecs deploy|gcloud|kubectl|helm|terraform|serverless|gh release|semantic-release)\b/,
  );
  cat('cache', /\b(actions\/cache|cache:\s*|save_cache|restore_cache)\b/);

  // matrix axes and values (simple)
  const nodeVers = new Set<string>();
  const pyVers = new Set<string>();
  const phpVers = new Set<string>();
  const javaVers = new Set<string>();
  const goVers = new Set<string>();
  const dotnetVers = new Set<string>();
  const rubyVers = new Set<string>();

  const grabVersions = (label: string, rx: RegExp, sink: Set<string>) => {
    const matches = text.match(new RegExp(rx.source, rx.flags + 'g')) || [];
    for (const m of matches) {
      const ver = m
        .split(':')[1]
        ?.trim()
        .replace(/^["']|["']$/g, '');
      if (ver) sink.add(`${label}=${ver}`);
    }
  };

  // setup actions
  grabVersions('node-version', /\bnode-version:\s*["']?[^"'\n]+/i, nodeVers);
  grabVersions('python-version', /\bpython-version:\s*["']?[^"'\n]+/i, pyVers);
  grabVersions('php-version', /\bphp-version:\s*["']?[^"'\n]+/i, phpVers);
  grabVersions('java-version', /\bjava-version:\s*["']?[^"'\n]+/i, javaVers);
  grabVersions('go-version', /\bgo-version:\s*["']?[^"'\n]+/i, goVers);
  grabVersions(
    'dotnet-version',
    /\bdotnet-version:\s*["']?[^"'\n]+/i,
    dotnetVers,
  );
  grabVersions('ruby-version', /\bruby-version:\s*["']?[^"'\n]+/i, rubyVers);

  // matrix axes
  const matLines = text.match(/matrix:[\s\S]{0,500}/i)?.[0] || '';
  const axisVals = new Set<string>();
  const kv = matLines.match(/([A-Za-z0-9_-]+):\s*\[([^\]]+)\]/g) || [];
  for (const a of kv) {
    const m = a.match(/([A-Za-z0-9_-]+):\s*\[([^\]]+)\]/);
    if (!m) continue;
    const key = m[1];
    const vals = m[2]
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''));
    for (const v of vals) axisVals.add(`${key}=${v}`);
  }
  axisVals.forEach((v) => matrix.add(v));
  nodeVers.forEach((v) => matrix.add(v));
  pyVers.forEach((v) => matrix.add(v));
  phpVers.forEach((v) => matrix.add(v));
  javaVers.forEach((v) => matrix.add(v));
  goVers.forEach((v) => matrix.add(v));
  dotnetVers.forEach((v) => matrix.add(v));
  rubyVers.forEach((v) => matrix.add(v));

  // name
  const name = (text.match(/^\s*name:\s*(.+)$/m)?.[1] || '').trim();

  return {
    name: name || undefined,
    triggers: [...triggers].sort(),
    jobs: jobsCount,
    steps: [...steps].sort(),
    matrix: [...matrix].sort(),
  };
};
