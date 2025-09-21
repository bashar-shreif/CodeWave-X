import { ManifestEntry } from './manifest.type';
import type { StackHit } from './stackHit.type';

export type ListFilesInput = {
  repoUri: string;
  includeGlobs?: string[];
  excludeGlobs?: string[];
  sizeLimitMB?: number;
  respectGitignore?: boolean;
};

export type ListFilesOutput = {
  repoHash: string;
  manifest: ManifestEntry[];
  totals: { files: number; bytes: number; skipped: number };
  ignored: { path: string; reason: string }[];
};

export type ScanLanguagesInput = {
  repoRoot: string;
  manifest: ManifestEntry[];
  mode?: 'LOC';
  normalize?: boolean;
};

export type ScanLanguagesOutput = {
  byLanguage: Record<string, { files: number; loc: number }>;
  totals: { files: number; loc: number };
  method: 'LOC';
};

export type DetectStackInput = { repoRoot: string; manifest: ManifestEntry[] };

export type DetectStackOutput = { hits: StackHit[] };
