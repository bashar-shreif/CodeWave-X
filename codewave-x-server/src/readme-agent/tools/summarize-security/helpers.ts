import fs from 'fs/promises';
import path from 'path';

export const pathExists = async (p: string) => {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
};
export const readJson = async <T = any>(p: string): Promise<T | null> => {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'));
  } catch {
    return null;
  }
};
export const readText = async (p: string, max = 512_000) => {
  try {
    const b = await fs.readFile(p);
    return b.slice(0, Math.min(b.length, max)).toString('utf8');
  } catch {
    return null;
  }
};
export const rel = (root: string, p: string) => path.relative(root, p);
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
    '.idea',
    '.vscode',
    '.gitlab',
    'coverage',
  ]);
  while (stack.length) {
    const cur = stack.pop()!;
    let ents: any[] = [];
    try {
      ents = await fs.readdir(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of ents) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (!skip.has(e.name)) stack.push(full);
      } else out.push(full);
    }
  }
  return out;
};

export const extsText = new Set([
  '.env',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.json',
  '.yml',
  '.yaml',
  '.py',
  '.php',
  '.go',
  '.rb',
  '.ini',
  '.cfg',
  '.conf',
  '.properties',
  '.toml',
  '.sh',
  '.dockerfile',
]);
export const isTextCandidate = (p: string) => {
  const bn = path.basename(p).toLowerCase();
  const ext = path.extname(bn);
  if (
    /\.(png|jpg|jpeg|gif|webp|svg|ico|pdf|zip|tar|gz|bz2|xz|7z|rar|wasm|woff2?|ttf|eot)$/i.test(
      bn,
    )
  )
    return false;
  if (bn.endsWith('.min.js')) return false;
  return extsText.has(ext) || /^\.env/.test(bn) || bn === 'dockerfile';
};

export const collectDeps = async (repoRoot: string) => {
  const security = new Set<string>();
  const auth = new Set<string>();
  const crypto = new Set<string>();
  const scanners = new Set<string>();

  // Node
  const pkg = await readJson<any>(path.join(repoRoot, 'package.json'));
  const depHas = (k: string) =>
    !!pkg &&
    ((pkg.dependencies && pkg.dependencies[k]) ||
      (pkg.devDependencies && pkg.devDependencies[k]));
  if (pkg) {
    for (const [k] of Object.entries({
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    })) {
      if (
        /helmet|cors|hpp|csurf|@fastify\/helmet|express-rate-limit|rate-limiter-flexible/i.test(
          k,
        )
      )
        security.add(k);
      if (
        /passport|@nestjs\/jwt|jsonwebtoken|cookie-session|express-session/i.test(
          k,
        )
      )
        auth.add(k);
      if (/argon2|bcrypt|bcryptjs|crypto-js|tweetnacl|libsodium|jose/i.test(k))
        crypto.add(k);
      if (
        /gitleaks|trufflehog|detect-secrets|semgrep|snyk|@snyk\/protect|depcheck/i.test(
          k,
        )
      )
        scanners.add(k);
    }
    if (pkg.scripts) {
      const vals = Object.values<string>(pkg.scripts);
      if (vals.some((s) => /codeql/.test(s))) scanners.add('codeql');
      if (vals.some((s) => /\bgitleaks\b/.test(s))) scanners.add('gitleaks');
      if (vals.some((s) => /\bsemgrep\b/.test(s))) scanners.add('semgrep');
      if (vals.some((s) => /\bsnyk\b/.test(s))) scanners.add('snyk');
    }
  }

  // Python
  const reqTxt = await readText(path.join(repoRoot, 'requirements.txt'));
  if (reqTxt) {
    if (/bandit/i.test(reqTxt)) scanners.add('bandit');
    if (/argon2-cffi|bcrypt|pyjwt/i.test(reqTxt)) {
      crypto.add('argon2/bcrypt');
      auth.add('PyJWT');
    }
    if (/django-cors-headers|flask-talisman/i.test(reqTxt))
      security.add('cors-headers/talisman');
  }

  // PHP
  const composer = await readJson<any>(path.join(repoRoot, 'composer.json'));
  if (composer) {
    const req = {
      ...(composer.require || {}),
      ...(composer['require-dev'] || {}),
    };
    for (const [k] of Object.entries(req)) {
      if (/vlucas\/phpdotenv/i.test(k)) security.add(k);
      if (/laravel\/sanctum|laravel\/passport|lcobucci\/jwt/i.test(k))
        auth.add(k);
      if (/paragonie|ramsey\/uuid/i.test(k)) crypto.add(k);
    }
  }

  return {
    security: [...security].sort(),
    auth: [...auth].sort(),
    crypto: [...crypto].sort(),
    scanners: [...scanners].sort(),
  };
};

export const SECRET_PATTERNS: Array<{ name: string; rx: RegExp }> = [
  { name: 'AWS Access Key', rx: /AKIA[0-9A-Z]{16}/g },
  { name: 'GitHub Token', rx: /ghp_[A-Za-z0-9]{36}/g },
  { name: 'Slack Token', rx: /xox[baprs]-[A-Za-z0-9-]{10,62}/g },
  { name: 'Google API Key', rx: /AIza[0-9A-Za-z\-_]{35}/g },
  { name: 'Stripe Secret Key', rx: /sk_live_[0-9a-zA-Z]{24,}/g },
  { name: 'Twilio API Key', rx: /SK[0-9a-fA-F]{32}/g },
  {
    name: 'Private Key Block',
    rx: /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/g,
  },
  {
    name: 'JWT Secret in env',
    rx: /(^|\s)(JWT_SECRET|SECRET_KEY)\s*=\s*[^#\s]+/gi,
  },
];

export const detectCorsWildcard = (txt: string) =>
  /Access-Control-Allow-Origin["']?\s*[,:\)]\s*["']\*["']/.test(txt) ||
  /origin\s*:\s*["']\*["']/.test(txt) ||
  /\bCORS_ORIGIN\s*=\s*\*/.test(txt);

export const detectDebugTrue = (txt: string) =>
  /\bDEBUG\s*=\s*true\b/i.test(txt);
