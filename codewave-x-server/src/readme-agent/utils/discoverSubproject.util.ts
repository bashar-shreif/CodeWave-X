import * as fs from 'fs';
import * as path from 'path';

export type Subproject = { name: string; root: string };

export const discoverSubprojects = async (
  repoRoot: string,
): Promise<Subproject[]> => {
  const out: Subproject[] = [];
  const pushIfPkg = (dir: string) => {
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) {
      const name = (() => {
        try {
          const raw = JSON.parse(fs.readFileSync(pkg, 'utf8'));
          return raw.name || path.basename(dir);
        } catch {
          return path.basename(dir);
        }
      })();
      out.push({ name, root: dir });
    }
  };

  pushIfPkg(repoRoot);

  const candidates = ['apps', 'packages', 'services', 'examples'];
  for (const c of candidates) {
    const base = path.join(repoRoot, c);
    if (!fs.existsSync(base)) continue;
    for (const d of fs.readdirSync(base, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      pushIfPkg(path.join(base, d.name));
    }
  }

  for (const d of fs.readdirSync(repoRoot, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    if (
      [
        'node_modules',
        '.git',
        'apps',
        'packages',
        'services',
        'examples',
      ].includes(d.name)
    )
      continue;
    pushIfPkg(path.join(repoRoot, d.name));
  }

  const uniq = new Map(out.map((s) => [s.root, s]));
  return Array.from(uniq.values());
};
