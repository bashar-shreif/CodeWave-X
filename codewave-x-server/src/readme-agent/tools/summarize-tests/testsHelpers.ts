import fs from 'fs/promises';
import path from 'path';
import { CoverageSummary } from 'src/readme-agent/types/coverageSummary.type';

export const readJson = async <T = any>(p: string): Promise<T | null> => {
  try {
    const buf = await fs.readFile(p, 'utf8');
    return JSON.parse(buf) as T;
  } catch {
    return null;
  }
};

export const pathExists = async (p: string): Promise<boolean> => {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
};

export const walk = async (root: string): Promise<string[]> => {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    const entries = await fs.readdir(cur, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        // light excludes
        if (
          [
            'node_modules',
            '.git',
            'dist',
            'build',
            '.venv',
            'venv',
            '.next',
            '.turbo',
            '.cache',
          ].includes(e.name)
        )
          continue;
        stack.push(full);
      } else {
        out.push(full);
      }
    }
  }
  return out;
};

export const guessPkgScripts = (pkg?: any): Record<string, string> => {
  const s = (pkg && pkg.scripts) || {};
  const known = ['test', 'test:unit', 'test:e2e', 'coverage', 'ci', 'lint'];
  const out: Record<string, string> = {};
  for (const k of known) if (typeof s[k] === 'string') out[k] = s[k];
  return out;
};

export const detectByFiles = (files: string[], repoRoot: string) => {
  const rel = (f: string) => path.relative(repoRoot, f);
  const pattHits: string[] = [];
  const testDirsSet = new Set<string>();
  let testFiles = 0;

  const addIf = (cond: boolean, label: string) => {
    if (cond) pattHits.push(label);
  };

  const frameworks = new Set<string>();
  const runners = new Set<string>();
  const assertions = new Set<string>();

  for (const f of files) {
    const r = rel(f);
    const bn = path.basename(f).toLowerCase();

    // patterns
    if (
      /\.(test|spec)\.[cm]?[jt]sx?$/.test(bn) ||
      r.includes('__tests__') ||
      r.startsWith('tests/') ||
      r.includes('/tests/')
    ) {
      testFiles += 1;
      pattHits.push('*.test|*.spec|__tests__|tests/');
      testDirsSet.add(path.dirname(r));
    }

    // configs
    addIf(/^jest\.config\.[cm]?js$|^jest\.config\.ts$/.test(bn), 'jest.config');
    addIf(
      /^vitest\.config\.[cm]?js$|^vitest\.config\.ts$/.test(bn),
      'vitest.config',
    );
    addIf(/^mocha\.(config|opts)/.test(bn), 'mocha config');
    addIf(/^ava\.config\./.test(bn), 'ava config');
    addIf(/^phpunit\.xml(?:\.dist)?$/.test(bn), 'phpunit.xml');
    addIf(/^pytest\.ini$|^tox\.ini$|^conftest\.py$/.test(bn), 'pytest/tox');
    addIf(/^nose2?\.cfg$/.test(bn), 'nose cfg');

    // infer frameworks/runners by file presence
    if (bn.startsWith('jest.config')) {
      frameworks.add('Jest');
      runners.add('Jest');
      assertions.add('Expect');
    }
    if (bn.startsWith('vitest.config')) {
      frameworks.add('Vitest');
      runners.add('Vitest');
      assertions.add('Vitest/Expect');
    }
    if (bn.startsWith('mocha.') || bn === 'mocha.opts') {
      frameworks.add('Mocha');
      runners.add('Mocha');
    }
    if (bn === 'phpunit.xml' || bn === 'phpunit.xml.dist') {
      frameworks.add('PHPUnit');
      runners.add('PHPUnit');
      assertions.add('PHPUnit Assert');
    }
    if (bn === 'pytest.ini' || bn === 'conftest.py' || bn === 'tox.ini') {
      frameworks.add('PyTest');
      runners.add('PyTest');
    }
  }

  return {
    pattHits,
    testDirs: [...testDirsSet].sort(),
    testFiles,
    frameworks,
    runners,
    assertions,
  };
};

export const detectByManifests = async (
  repoRoot: string,
  acc: {
    frameworks: Set<string>;
    runners: Set<string>;
    assertions: Set<string>;
    scripts: Record<string, string>;
  },
) => {
  // Node
  const pkg = await readJson<any>(path.join(repoRoot, 'package.json'));
  if (pkg) {
    const deps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    const has = (k: string) => deps[k] !== undefined;
    if (has('jest')) {
      acc.frameworks.add('Jest');
      acc.runners.add('Jest');
      acc.assertions.add('Expect');
    }
    if (has('vitest')) {
      acc.frameworks.add('Vitest');
      acc.runners.add('Vitest');
      acc.assertions.add('Vitest/Expect');
    }
    if (has('mocha')) {
      acc.frameworks.add('Mocha');
      acc.runners.add('Mocha');
    }
    if (has('ava')) {
      acc.frameworks.add('AVA');
      acc.runners.add('AVA');
    }
    if (has('@playwright/test')) {
      acc.frameworks.add('Playwright');
      acc.runners.add('Playwright');
    }
    if (has('cypress')) {
      acc.frameworks.add('Cypress');
      acc.runners.add('Cypress');
    }
    if (has('@testing-library/jest-dom') || has('@testing-library/react'))
      acc.assertions.add('Testing Library');
    Object.assign(acc.scripts, guessPkgScripts(pkg));
  }

  // PHP
  const composer = await readJson<any>(path.join(repoRoot, 'composer.json'));
  if (composer) {
    const req = {
      ...(composer.require || {}),
      ...(composer['require-dev'] || {}),
    };
    const has = (k: string) => req[k] !== undefined;
    if (has('phpunit/phpunit')) {
      acc.frameworks.add('PHPUnit');
      acc.runners.add('PHPUnit');
      acc.assertions.add('PHPUnit Assert');
    }
    if (composer.scripts) {
      for (const [k, v] of Object.entries<string>(composer.scripts)) {
        if (/(test|phpunit)/i.test(k) || /(phpunit)/i.test(v))
          acc.scripts[k] = v;
      }
    }
  }

  // Python
  const pyProject =
    (await readJson<any>(path.join(repoRoot, 'pyproject.json'))) ||
    (await readJson<any>(path.join(repoRoot, 'pyproject.toml'))); // JSON fallback if user mirrors TOML as JSON
  const reqTxt = await pathExists(path.join(repoRoot, 'requirements.txt'));
  if (pyProject || reqTxt) {
    acc.frameworks.add('PyTest');
    acc.runners.add('PyTest');
    acc.assertions.add('pytest assert');
  }
};

export const parseCoverageSummaryJson = async (p: string) => {
  const j = await readJson<{ total?: CoverageSummary }>(p);
  if (!j || !j.total) return null;
  const t = j.total;
  return {
    source: 'coverage-summary.json' as const,
    linesPct: t.lines?.pct,
    statementsPct: t.statements?.pct,
    branchesPct: t.branches?.pct,
    functionsPct: t.functions?.pct,
  };
};

export const parseLcov = async (p: string) => {
  try {
    const txt = await fs.readFile(p, 'utf8');
    let lf = 0,
      lh = 0;
    for (const line of txt.split('\n')) {
      if (line.startsWith('LF:')) lf += Number(line.slice(3).trim());
      if (line.startsWith('LH:')) lh += Number(line.slice(3).trim());
    }
    if (lf === 0) return null;
    const pct = Math.max(0, Math.min(100, (lh / lf) * 100));
    return { source: 'lcov.info' as const, linesPct: Number(pct.toFixed(2)) };
  } catch {
    return null;
  }
};

export const parseJUnit = async (p: string) => {
  try {
    const xml = await fs.readFile(p, 'utf8');
    // naive attribute extraction
    const getAttr = (attr: string) => {
      const m = xml.match(new RegExp(`${attr}="([0-9]+)"`));
      return m ? Number(m[1]) : undefined;
    };
    const tests = getAttr('tests');
    const failures = getAttr('failures') ?? getAttr('failed');
    const skipped = getAttr('skipped');
    if (tests === undefined && failures === undefined && skipped === undefined)
      return null;
    return {
      source: 'junit.xml' as const,
      totals: { tests, failures, skipped },
    };
  } catch {
    return null;
  }
};
