import fs from 'fs/promises';
import path from 'path';
import { SecretHit } from '../../types/secureHit.type';
import { SummarizeSecurityOutput } from '../../types/io.type';
import { walk, pathExists, readText, rel, isTextCandidate, detectCorsWildcard, detectDebugTrue, SECRET_PATTERNS, collectDeps } from './securityHelpers';

export const summarizeSecurity = async (
  repoRoot: string,
): Promise<SummarizeSecurityOutput> => {
  const files = await walk(repoRoot);

  // env files
  const envFiles = files.filter((f) =>
    /(^|\/)\.env(\.|$)|(^|\/)env\./i.test(f),
  );
  const envExample = files.filter((f) =>
    /(^|\/)\.env\.example$|(^|\/)example\.env$/i.test(f),
  );

  // .gitignore protection
  let gitignoreProtectsEnv = false;
  const giPath = path.join(repoRoot, '.gitignore');
  if (await pathExists(giPath)) {
    const gi = (await readText(giPath)) || '';
    gitignoreProtectsEnv =
      /^\s*\.env(\..+)?\s*$/m.test(gi) ||
      /^\s*\*\.env\s*$/m.test(gi) ||
      /^\s*\.env\*/m.test(gi);
  }

  // sensitive files
  const sensitiveFilesSet = new Set<string>();
  for (const p of files) {
    const bn = path.basename(p).toLowerCase();
    if (/\.(pem|key|p12|jks|keystore|pfx|crt|cert)$/i.test(bn))
      sensitiveFilesSet.add(rel(repoRoot, p));
    if (/^id_(rsa|dsa|ecdsa|ed25519)$/.test(bn))
      sensitiveFilesSet.add(rel(repoRoot, p));
    if (/service[-_.]?account\.json$/i.test(bn))
      sensitiveFilesSet.add(rel(repoRoot, p));
  }

  // CI security configs
  const ciSecurity = new Set<string>();
  const ghaDir = path.join(repoRoot, '.github', 'workflows');
  if (await pathExists(ghaDir)) {
    const wfs = await fs.readdir(ghaDir);
    if (wfs.some((f) => /codeql/i.test(f))) ciSecurity.add('GitHub CodeQL');
    if (wfs.some((f) => /gitleaks/i.test(f)))
      ciSecurity.add('Gitleaks workflow');
    if (wfs.some((f) => /semgrep/i.test(f))) ciSecurity.add('Semgrep workflow');
    if (wfs.some((f) => /snyk/i.test(f))) ciSecurity.add('Snyk workflow');
  }
  if (
    (await pathExists(path.join(repoRoot, 'gitleaks.toml'))) ||
    (await pathExists(path.join(repoRoot, '.gitleaks.toml')))
  )
    ciSecurity.add('Gitleaks config');
  if (
    (await pathExists(path.join(repoRoot, '.semgrep.yml'))) ||
    (await pathExists(path.join(repoRoot, 'semgrep.yml')))
  )
    ciSecurity.add('Semgrep rules');
  if (
    (await pathExists(path.join(repoRoot, '.snyk'))) ||
    (await pathExists(path.join(repoRoot, 'snyk.yml')))
  )
    ciSecurity.add('Snyk config');

  // scan text for secrets and policies
  const corsWildcard: string[] = [];
  const debugTrue: string[] = [];
  const secretCounts = new Map<string, number>(); // key=category@relPath -> count
  for (const abs of files) {
    if (!isTextCandidate(abs)) continue;
    const txt = await readText(abs);
    if (!txt) continue;

    // CORS
    if (detectCorsWildcard(txt)) corsWildcard.push(rel(repoRoot, abs));
    // DEBUG
    if (detectDebugTrue(txt)) debugTrue.push(rel(repoRoot, abs));

    // secrets
    for (const { name, rx } of SECRET_PATTERNS) {
      const matches = txt.match(rx);
      if (matches && matches.length > 0) {
        const key = `${name}@${rel(repoRoot, abs)}`;
        secretCounts.set(key, (secretCounts.get(key) || 0) + matches.length);
      }
    }

    // Google service account JSON heuristic
    if (
      abs.toLowerCase().endsWith('.json') &&
      /"type"\s*:\s*"service_account"/.test(txt) &&
      /"private_key_id"\s*:\s*"/.test(txt)
    ) {
      const key = `Google Service Account@${rel(repoRoot, abs)}`;
      secretCounts.set(key, 1 + (secretCounts.get(key) || 0));
      sensitiveFilesSet.add(rel(repoRoot, abs));
    }
  }

  const secretMatches: SecretHit[] = [];
  for (const [k, count] of secretCounts.entries()) {
    const [category, p] = k.split('@');
    secretMatches.push({ category, path: p, count });
  }
  secretMatches.sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.path.localeCompare(b.path),
  );

  // deps
  const libs = await collectDeps(repoRoot);

  // risk score
  let score = 0;
  const notes: string[] = [];
  const hasKeyFile = Array.from(sensitiveFilesSet).some(
    (p) =>
      /\.(pem|key|p12|jks|keystore|pfx)$/i.test(p) ||
      /^id_/.test(path.basename(p)),
  );
  if (hasKeyFile) {
    score += 50;
    notes.push('Key/certificate file present');
  }
  if (
    secretMatches.some((s) =>
      /Private Key Block|Google Service Account|GitHub Token|AWS|Stripe|Slack|Twilio/.test(
        s.category,
      ),
    )
  ) {
    score += 30;
    notes.push('High-risk secret patterns detected');
  }
  if (envFiles.length > 0 && !gitignoreProtectsEnv) {
    score += 20;
    notes.push('.env present and not ignored');
  }
  if (corsWildcard.length > 0) {
    score += 15;
    notes.push('CORS wildcard detected');
  }
  if (debugTrue.length > 0) {
    score += 10;
    notes.push('DEBUG=true detected');
  }
  if (score > 100) score = 100;

  return {
    libs,
    env: {
      files: envFiles.map((p) => rel(repoRoot, p)).sort(),
      examples: envExample.map((p) => rel(repoRoot, p)).sort(),
      gitignoreProtectsEnv,
    },
    sensitiveFiles: [...sensitiveFilesSet].sort(),
    secretMatches,
    policies: {
      corsWildcard: corsWildcard.sort(),
      debugTrue: debugTrue.sort(),
    },
    ciSecurity: [...ciSecurity].sort(),
    status: { riskScore: score, notes },
  };
};
