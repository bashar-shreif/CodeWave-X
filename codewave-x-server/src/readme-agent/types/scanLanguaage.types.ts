import { ManifestEntry } from "./manifest.type";

export type ScanLanguagesInput = {
  repoRoot: string;
  manifest: ManifestEntry[];
  mode?: "LOC";
  normalize?: boolean;
};

export type ScanLanguagesOutput = {
  byLanguage: Record<string, { files: number; loc: number }>;
  totals: { files: number; loc: number };
  method: "LOC";
};