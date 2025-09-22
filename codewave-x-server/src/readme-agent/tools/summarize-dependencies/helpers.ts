import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

export const fromPackageJson = (pkg: any) => {
  const runtime: string[] = [];
  const dev: string[] = [];
  const tools: string[] = [];
  const pkgManagers: string[] = [];
  const scripts: Record<string, string> = {};
  const notes: string[] = [];

  if (!pkg) return { runtime, dev, tools, pkgManagers, scripts, notes };

  const deps = Object.entries({
    ...(pkg.dependencies || {}),
    ...(pkg.peerDependencies || {}),
  });
  const devDeps = Object.entries(pkg.devDependencies || {});

  for (const [name, ver] of deps) runtime.push(`${name}@${String(ver)}`);
  for (const [name, ver] of devDeps) dev.push(`${name}@${String(ver)}`);

  if (pkg.scripts && typeof pkg.scripts === 'object') {
    for (const [k, v] of Object.entries(pkg.scripts)) {
      if (typeof v === 'string') scripts[k] = v;
    }
  }

  // heuristics
  if (deps.some(([n]) => n === 'react')) tools.push('react');
  if (deps.some(([n]) => n === 'next')) tools.push('next');
  if (deps.some(([n]) => n.startsWith('@nestjs/'))) tools.push('nest');
  if (deps.some(([n]) => n === 'vue')) tools.push('vue');
  if (deps.some(([n]) => n === 'angular' || n.startsWith('@angular/')))
    tools.push('angular');
  if (deps.some(([n]) => n === 'express')) tools.push('express');
  if (deps.some(([n]) => n === 'fastify')) tools.push('fastify');
  if (devDeps.some(([n]) => n.includes('eslint'))) tools.push('eslint');
  if (devDeps.some(([n]) => n.includes('prettier'))) tools.push('prettier');
  if (devDeps.some(([n]) => n.includes('vite'))) tools.push('vite');
  if (devDeps.some(([n]) => n.includes('webpack'))) tools.push('webpack');
  if (devDeps.some(([n]) => n.includes('jest'))) tools.push('jest');
  if (devDeps.some(([n]) => n.includes('vitest'))) tools.push('vitest');
  if (devDeps.some(([n]) => n.includes('cypress'))) tools.push('cypress');

  // packageManager field (npm/yarn/pnpm) or lockfiles
  if (typeof pkg.packageManager === 'string') {
    if (pkg.packageManager.startsWith('npm')) pkgManagers.push('npm');
    else if (pkg.packageManager.startsWith('yarn')) pkgManagers.push('yarn');
    else if (pkg.packageManager.startsWith('pnpm')) pkgManagers.push('pnpm');
  }

  return { runtime, dev, tools, pkgManagers, scripts, notes };
};

export const fromComposerJson = (composer: any) => {
  const runtime: string[] = [];
  const dev: string[] = [];
  const tools: string[] = [];
  const pkgManagers: string[] = [];
  const scripts: Record<string, string> = {};
  const notes: string[] = [];

  if (!composer) return { runtime, dev, tools, pkgManagers, scripts, notes };

  for (const [name, ver] of Object.entries(composer.require || {}))
    runtime.push(`${name}@${String(ver)}`);
  for (const [name, ver] of Object.entries(composer['require-dev'] || {}))
    dev.push(`${name}@${String(ver)}`);

  if (composer.scripts && typeof composer.scripts === 'object') {
    for (const [k, v] of Object.entries(composer.scripts)) {
      if (typeof v === 'string') scripts[k] = v;
      else if (Array.isArray(v)) scripts[k] = v.join(' && ');
    }
  }

  pkgManagers.push('composer');
  if (runtime.some((x) => x.startsWith('laravel/'))) tools.push('laravel');
  if (
    runtime.some((x) => x.startsWith('phpunit/')) ||
    dev.some((x) => x.includes('phpunit'))
  )
    tools.push('phpunit');

  return { runtime, dev, tools, pkgManagers, scripts, notes };
};

export const fromPython = (
  requirementsTxt: string | null,
  pyprojectToml: string | null,
) => {
  const runtime: string[] = [];
  const dev: string[] = [];
  const tools: string[] = [];
  const pkgManagers: string[] = [];
  const scripts: Record<string, string> = {};
  const notes: string[] = [];

  if (requirementsTxt) {
    for (const line of requirementsTxt.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      if (/^-e\s+/.test(t)) {
        runtime.push(t);
        continue;
      }
      runtime.push(t);
      if (/^Django\b/i.test(t)) tools.push('django');
      if (/\bFlask\b/i.test(t)) tools.push('flask');
      if (/\bpytest\b/i.test(t)) tools.push('pytest');
    }
    pkgManagers.push('pip');
  }
  if (pyprojectToml) {
    if (/^\s*\[tool\.poetry\]/m.test(pyprojectToml)) pkgManagers.push('poetry');
    if (/^\s*\[project\]\s*$/m.test(pyprojectToml)) pkgManagers.push('pip');
    if (
      /^\s*\[project\.dependencies\]/m.test(pyprojectToml) ||
      /dependencies\s*=\s*\[/m.test(pyprojectToml)
    )
      notes.push('pyproject dependencies present');
  }

  return { runtime, dev, tools, pkgManagers, scripts, notes };
};

export const fromPubspec = (pubspec: string | null) => {
  const runtime: string[] = [];
  const dev: string[] = [];
  const tools: string[] = [];
  const pkgManagers: string[] = [];
  const scripts: Record<string, string> = {};
  const notes: string[] = [];

  if (!pubspec) return { runtime, dev, tools, pkgManagers, scripts, notes };

  if (/sdk:\s*flutter/i.test(pubspec)) tools.push('flutter');
  const depBlocks = pubspec.split(/\r?\n/);
  for (const line of depBlocks) {
    const m = line.match(/^\s*([a-zA-Z0-9_]+)\s*:\s*([^\s#][^\s#]*)?/);
    if (
      m &&
      ![
        'dependencies',
        'dev_dependencies',
        'sdk',
        'environment',
        'name',
        'description',
        'version',
        'flutter',
      ].includes(m[1])
    ) {
      runtime.push(`${m[1]}@${m[2] || 'latest'}`);
    }
  }
  pkgManagers.push('pub');

  return { runtime, dev, tools, pkgManagers, scripts, notes };
};

export const fromCsproj = (csprojTxts: string[]) => {
  const runtime: string[] = [];
  const dev: string[] = [];
  const tools: string[] = [];
  const pkgManagers: string[] = [];
  const scripts: Record<string, string> = {};
  const notes: string[] = [];

  if (csprojTxts.length) {
    pkgManagers.push('dotnet');
    if (csprojTxts.some((t) => /Microsoft\.AspNetCore\./i.test(t)))
      tools.push('aspnet');
    for (const t of csprojTxts) {
      const rx =
        /<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"\s*\/>/g;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(t))) runtime.push(`${m[1]}@${m[2]}`);
    }
  }
  return { runtime, dev, tools, pkgManagers, scripts, notes };
};

export const fromGoMod = (goMod: string | null) => {
  const runtime: string[] = [];
  const dev: string[] = [];
  const tools: string[] = [];
  const pkgManagers: string[] = [];
  const scripts: Record<string, string> = {};
  const notes: string[] = [];

  if (!goMod) return { runtime, dev, tools, pkgManagers, scripts, notes };
  pkgManagers.push('go');
  const rx = /^\s*require\s+([^\s]+)\s+([^\s]+)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(goMod))) runtime.push(`${m[1]}@${m[2]}`);
  return { runtime, dev, tools, pkgManagers, scripts, notes };
};

export const fromCargoToml = (cargo: string | null) => {
  const runtime: string[] = [];
  const dev: string[] = [];
  const tools: string[] = [];
  const pkgManagers: string[] = [];
  const scripts: Record<string, string> = {};
  const notes: string[] = [];

  if (!cargo) return { runtime, dev, tools, pkgManagers, scripts, notes };
  pkgManagers.push('cargo');
  const rx = /^\s*([A-Za-z0-9_\-]+)\s*=\s*["']?([0-9A-Za-z\.\-\*]+)["']?/gm;
  // naive: only inside [dependencies] or [dev-dependencies]
  const sectionRx = /^\s*\[(dev-)?dependencies\]\s*$/m;
  if (sectionRx.test(cargo)) {
    let m: RegExpExecArray | null;
    while ((m = rx.exec(cargo))) runtime.push(`${m[1]}@${m[2]}`);
  }
  return { runtime, dev, tools, pkgManagers, scripts, notes };
};

export const fromGemfile = (gemfile: string | null) => {
  const runtime: string[] = [];
  const dev: string[] = [];
  const tools: string[] = [];
  const pkgManagers: string[] = [];
  const scripts: Record<string, string> = {};
  const notes: string[] = [];

  if (!gemfile) return { runtime, dev, tools, pkgManagers, scripts, notes };
  pkgManagers.push('bundler');
  const rx = /^\s*gem\s+['"]([^'"]+)['"]\s*(,\s*['"]([^'"]+)['"])?/gm;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(gemfile))) runtime.push(`${m[1]}@${m[3] || 'latest'}`);
  if (/rails/i.test(gemfile)) tools.push('rails');
  return { runtime, dev, tools, pkgManagers, scripts, notes };
};

export const toPosix = (p: string) => p.replace(/\\/g, '/');

export const readIfExists = async (
  root: string,
  rel: string,
  files: Set<string>,
): Promise<string | null> => {
  rel = toPosix(rel);
  if (!files.has(rel)) return null;
  try {
    return await fsp.readFile(path.join(root, rel), 'utf8');
  } catch {
    return null;
  }
};

export const pushUnique = (
  arr: string[],
  ...vals: (string | null | undefined)[]
) => {
  for (const v of vals) if (v && !arr.includes(v)) arr.push(v);
};

export const parseJson = (txt: string | null): any | null => {
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
};
