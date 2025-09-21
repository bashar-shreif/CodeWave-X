const textHasAny = (
  txt: string | null,
  needles: (RegExp | string)[],
): boolean => {
  if (!txt) return false;
  return needles.some((n) =>
    typeof n === 'string' ? txt.includes(n) : n.test(txt),
  );
};

const hasAnyFile = (
  files: Set<string>,
  roots: string[],
  names: string[],
): string | null => {
  for (const r of roots)
    for (const n of names) {
      const p = r ? `${r}/${n}` : n;
      if (files.has(p)) return p;
    }
  return null;
};

const hasAnyDirPrefix = (files: Set<string>, prefixes: string[]): boolean => {
  for (const p of files)
    if (prefixes.some((pref) => p.startsWith(pref))) return true;
  return false;
};

export const detectLaravel = (
  files: Set<string>,
  composer: any,
  roots: string[],
): { score: number; reasons: string[] } => {
  let s = 0;
  const reasons: string[] = [];
  if (
    composer?.require &&
    (composer.require['laravel/framework'] ||
      composer.require['laravel/lumen-framework'])
  ) {
    s += 3;
    reasons.push('composer: laravel/framework');
  }
  if (files.has('artisan')) {
    s += 2;
    reasons.push('file: artisan');
  }
  if (hasAnyDirPrefix(files, ['app/', 'routes/', 'config/'])) {
    s += 1;
    reasons.push('dirs: app|routes|config');
  }
  return { score: s, reasons };
};

export const detectReact = (
  pkg: any,
  files: Set<string>,
  roots: string[],
): { score: number; reasons: string[] } => {
  let s = 0;
  const reasons: string[] = [];
  const deps = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
  };
  if (deps['next']) return { score: 0, reasons }; // Next wins separately
  if (deps['react']) {
    s += 3;
    reasons.push('package.json: react');
  }
  if (
    files.has('vite.config.ts') ||
    files.has('vite.config.js') ||
    deps['react-scripts']
  ) {
    s += 1;
    reasons.push('tooling: vite|react-scripts');
  }
  if (
    files.has('public/index.html') ||
    hasAnyFile(files, [''], ['src/App.tsx', 'src/App.jsx'])
  ) {
    s += 1;
    reasons.push('files: src/App.*, public/index.html');
  }
  return { score: s, reasons };
};

export const detectNext = (
  pkg: any,
  files: Set<string>,
): { score: number; reasons: string[] } => {
  let s = 0;
  const reasons: string[] = [];
  const deps = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
  };
  if (deps['next']) {
    s += 3;
    reasons.push('package.json: next');
  }
  if (
    files.has('next.config.js') ||
    files.has('next.config.ts') ||
    hasAnyDirPrefix(files, ['pages/', 'app/'])
  ) {
    s += 2;
    reasons.push('next.config|pages|app');
  }
  if (
    pkg?.scripts &&
    (pkg.scripts['dev']?.includes('next') ||
      pkg.scripts['build']?.includes('next') ||
      pkg.scripts['start']?.includes('next'))
  ) {
    s += 1;
    reasons.push('scripts: next');
  }
  return { score: s, reasons };
};

export const detectNest = (
  pkg: any,
  files: Set<string>,
): { score: number; reasons: string[] } => {
  let s = 0;
  const reasons: string[] = [];
  const deps = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
  };
  if (deps['@nestjs/core'] || deps['@nestjs/common']) {
    s += 3;
    reasons.push('package.json: @nestjs/*');
  }
  if (files.has('src/main.ts') && files.has('src/app.module.ts')) {
    s += 2;
    reasons.push('files: src/main.ts, src/app.module.ts');
  }
  if (
    pkg?.scripts &&
    Object.values(pkg.scripts).some(
      (v: any) => typeof v === 'string' && /nest\s+(start|build)/.test(v),
    )
  ) {
    s += 1;
    reasons.push('scripts: nest');
  }
  return { score: s, reasons };
};

export const detectAngular = (
  pkg: any,
  files: Set<string>,
  angularJson: any,
): { score: number; reasons: string[] } => {
  let s = 0;
  const reasons: string[] = [];
  const deps = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
  };
  if (deps['@angular/core']) {
    s += 3;
    reasons.push('package.json: @angular/core');
  }
  if (angularJson) {
    s += 2;
    reasons.push('angular.json');
  }
  return { score: s, reasons };
};

export const detectVue = (
  pkg: any,
  files: Set<string>,
): { score: number; reasons: string[] } => {
  let s = 0;
  const reasons: string[] = [];
  const deps = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
  };
  if (deps['vue']) {
    s += 3;
    reasons.push('package.json: vue');
  }
  if (
    files.has('vite.config.ts') ||
    files.has('vite.config.js') ||
    files.has('vue.config.js')
  ) {
    s += 1;
    reasons.push('tooling: vite|vue.config');
  }
  if (hasAnyFile(files, [''], ['src/App.vue', 'src/main.ts', 'src/main.js'])) {
    s += 1;
    reasons.push('files: src/App.vue|main');
  }
  return { score: s, reasons };
};

export const detectNode = (
  pkg: any,
  files: Set<string>,
): { score: number; reasons: string[] } => {
  let s = 0;
  const reasons: string[] = [];
  if (pkg) {
    s += 2;
    reasons.push('package.json');
  }
  const deps = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
  };
  if (deps['express'] || deps['koa'] || deps['hapi'] || deps['fastify']) {
    s += 1;
    reasons.push('server deps');
  }
  if (
    files.has('index.js') ||
    files.has('index.ts') ||
    files.has('src/index.js') ||
    files.has('src/index.ts')
  ) {
    s += 1;
    reasons.push('entry index.*');
  }
  return { score: s, reasons };
};

export const detectFlutter = (
  pubspecTxt: string | null,
  files: Set<string>,
): { score: number; reasons: string[] } => {
  let s = 0;
  const reasons: string[] = [];
  if (textHasAny(pubspecTxt, [/sdk:\s*flutter/])) {
    s += 3;
    reasons.push('pubspec: sdk flutter');
  }
  if (files.has('lib/main.dart')) {
    s += 2;
    reasons.push('file: lib/main.dart');
  }
  if (hasAnyDirPrefix(files, ['android/', 'ios/'])) {
    s += 1;
    reasons.push('dirs: android|ios');
  }
  return { score: s, reasons };
};

export const detectDjango = (
  reqTxt: string | null,
  files: Set<string>,
): { score: number; reasons: string[] } => {
  let s = 0;
  const reasons: string[] = [];
  if (textHasAny(reqTxt, [/^Django\b/i, /\bDjango==/i])) {
    s += 3;
    reasons.push('requirements: Django');
  }
  if (files.has('manage.py')) {
    s += 2;
    reasons.push('file: manage.py');
  }
  if (Array.from(files).some((p) => /settings\.py$/.test(p))) {
    s += 1;
    reasons.push('settings.py');
  }
  return { score: s, reasons };
};

export const detectFlask = (
  reqTxt: string | null,
  files: Set<string>,
): { score: number; reasons: string[] } => {
  let s = 0;
  const reasons: string[] = [];
  if (textHasAny(reqTxt, [/\bFlask\b/i])) {
    s += 3;
    reasons.push('requirements: Flask');
  }
  if (files.has('app.py') || files.has('wsgi.py')) {
    s += 1;
    reasons.push('file: app.py|wsgi.py');
  }
  return { score: s, reasons };
};

export const detectAspNet = (
  csprojTxts: string[],
): {
  score: number;
  reasons: string[];
} => {
  let s = 0;
  const reasons: string[] = [];
  const hasCsproj = csprojTxts.length > 0;
  if (hasCsproj && csprojTxts.some((t) => /<TargetFramework>net/i.test(t))) {
    s += 3;
    reasons.push('*.csproj: TargetFramework net*');
  }
  if (csprojTxts.some((t) => /Microsoft\.AspNetCore\./i.test(t))) {
    s += 1;
    reasons.push('deps: Microsoft.AspNetCore');
  }
  return { score: s, reasons };
};
