import { ManifestEntry } from './manifest.type';

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
};
