import fs from 'fs/promises';
import path from 'path';
import { CIWorkflow } from '../../types/tools/ciWorkflow.type';
import { pathExists, readText, rel, walk, analyzeYamlText } from './helpers';
import { SummarizeCIOutput } from '../../types/tools/io.type';

export const summarizeCI = async (
  repoRoot: string,
): Promise<SummarizeCIOutput> => {
  const files = await walk(repoRoot);
  const ciFiles: { provider: CIWorkflow['provider']; path: string }[] = [];

  // GitHub Actions
  const ghaDir = path.join(repoRoot, '.github', 'workflows');
  if (await pathExists(ghaDir)) {
    const gha = await fs.readdir(ghaDir);
    for (const f of gha) {
      if (/\.(ya?ml)$/i.test(f))
        ciFiles.push({
          provider: 'GitHub Actions',
          path: path.join(ghaDir, f),
        });
    }
  }

  // GitLab
  for (const base of ['.gitlab-ci.yml', '.gitlab-ci.yaml']) {
    const p = path.join(repoRoot, base);
    if (await pathExists(p)) ciFiles.push({ provider: 'GitLab CI', path: p });
  }

  // CircleCI
  const circle = path.join(repoRoot, '.circleci', 'config.yml');
  if (await pathExists(circle))
    ciFiles.push({ provider: 'CircleCI', path: circle });
  const circle2 = path.join(repoRoot, '.circleci', 'config.yaml');
  if (await pathExists(circle2))
    ciFiles.push({ provider: 'CircleCI', path: circle2 });

  // Travis
  for (const base of ['.travis.yml', '.travis.yaml']) {
    const p = path.join(repoRoot, base);
    if (await pathExists(p)) ciFiles.push({ provider: 'Travis CI', path: p });
  }

  // Azure Pipelines
  for (const base of ['azure-pipelines.yml', 'azure-pipelines.yaml']) {
    const p = path.join(repoRoot, base);
    if (await pathExists(p))
      ciFiles.push({ provider: 'Azure Pipelines', path: p });
  }

  // Jenkins
  // Scan for Jenkinsfile at root or near root
  const jenkins = files.filter((f) => /(^|\/)Jenkinsfile$/.test(f));
  for (const p of jenkins) ciFiles.push({ provider: 'Jenkins', path: p });

  const workflows: CIWorkflow[] = [];
  const providers = new Set<string>();
  const secrets = new Set<string>();
  const caching = new Set<string>();
  const langs = {
    node: new Set<string>(),
    python: new Set<string>(),
    php: new Set<string>(),
    java: new Set<string>(),
    go: new Set<string>(),
    dotnet: new Set<string>(),
    ruby: new Set<string>(),
  };

  for (const cf of ciFiles) {
    const txt = await readText(cf.path);
    if (!txt) continue;
    providers.add(cf.provider);
    const meta = analyzeYamlText(cf.provider, txt);
    workflows.push({
      provider: cf.provider,
      path: rel(repoRoot, cf.path),
      ...meta,
    });

    // secrets
    const secMatches = txt.match(/\bsecrets\.([A-Z0-9_]+)/g) || [];
    secMatches.forEach((m) => secrets.add(m.split('.')[1]));
    const envSecretMatches =
      txt.match(/\$\{?\{?\s*secrets\.([A-Z0-9_]+)\s*\}?\}?/gi) || [];
    envSecretMatches.forEach((m) => {
      const mm = m.match(/secrets\.([A-Z0-9_]+)/i);
      if (mm) secrets.add(mm[1].toUpperCase());
    });
    if (/\bGITHUB_TOKEN\b/.test(txt)) secrets.add('GITHUB_TOKEN');
    if (/\bCI_JOB_TOKEN\b/.test(txt)) secrets.add('CI_JOB_TOKEN');

    // caching
    if (/actions\/cache@/i.test(txt)) caching.add('GitHub Actions cache');
    if (
      /\bcache:\s*(paths|key|policy)/i.test(txt) &&
      cf.provider === 'GitLab CI'
    )
      caching.add('GitLab cache');
    if (
      /\b(save_cache|restore_cache)\b/.test(txt) &&
      cf.provider === 'CircleCI'
    )
      caching.add('CircleCI cache');
    if (/\b(npm cache|pnpm store|yarn cache)/i.test(txt))
      caching.add('Package manager cache');

    // language versions (aggregate)
    const pushVers = (target: Set<string>, rx: RegExp, label: string) => {
      (txt.match(new RegExp(rx.source, rx.flags + 'g')) || []).forEach(
        (line) => {
          const v = line
            .split(':')[1]
            ?.trim()
            .replace(/^["']|["']$/g, '');
          if (v) target.add(v);
        },
      );
    };
    pushVers(langs.node, /\bnode-version:\s*["']?[^"'\n]+/i, 'node');
    pushVers(langs.python, /\bpython-version:\s*["']?[^"'\n]+/i, 'python');
    pushVers(langs.php, /\bphp-version:\s*["']?[^"'\n]+/i, 'php');
    pushVers(langs.java, /\bjava-version:\s*["']?[^"'\n]+/i, 'java');
    pushVers(langs.go, /\bgo-version:\s*["']?[^"'\n]+/i, 'go');
    pushVers(langs.dotnet, /\bdotnet-version:\s*["']?[^"'\n]+/i, 'dotnet');
    pushVers(langs.ruby, /\bruby-version:\s*["']?[^"'\n]+/i, 'ruby');

    // also matrix arrays like [18.x, 20.x]
    (
      txt.match(/\b(node|python|php|java|go|ruby)-version:\s*\[([^\]]+)\]/gi) ||
      []
    ).forEach((m) => {
      const mm = m.match(/\b([A-Za-z]+)-version:\s*\[([^\]]+)\]/i);
      if (!mm) return;
      const lang = mm[1].toLowerCase();
      const vals = mm[2]
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''));
      for (const v of vals) {
        if (lang === 'node') langs.node.add(v);
        if (lang === 'python') langs.python.add(v);
        if (lang === 'php') langs.php.add(v);
        if (lang === 'java') langs.java.add(v);
        if (lang === 'go') langs.go.add(v);
        if (lang === 'ruby') langs.ruby.add(v);
      }
    });
  }

  const notes: string[] = [];
  if (ciFiles.length === 0) notes.push('No CI configuration files detected');

  return {
    providers: [...providers].sort(),
    files: ciFiles.map((f) => rel(repoRoot, f.path)).sort(),
    workflows: workflows.sort(
      (a, b) =>
        a.provider.localeCompare(b.provider) || a.path.localeCompare(b.path),
    ),
    languages: {
      node: [...langs.node].sort(),
      python: [...langs.python].sort(),
      php: [...langs.php].sort(),
      java: [...langs.java].sort(),
      go: [...langs.go].sort(),
      dotnet: [...langs.dotnet].sort(),
      ruby: [...langs.ruby].sort(),
    },
    secrets: [...secrets].sort(),
    caching: [...caching].sort(),
    status: { hasCI: ciFiles.length > 0, notes },
  };
};
