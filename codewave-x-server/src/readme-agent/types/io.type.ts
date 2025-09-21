import { ManifestEntry } from './manifest.type';
import type { StackHit } from './stackHit.type';
import { StatBlock } from './statBlock.type';
import { RouteEntry } from './routeEntry.type';
import { Component } from './component.type';
import { LangProfile } from './langProfile.type';

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

export type ComputeStatsInput = {
  repoRoot: string;
  manifest: ManifestEntry[];
  includeLangs?: string[];
};

export type ComputeStatsOutput = {
  totals: StatBlock;
  byLanguage: Record<string, StatBlock>;
};

export type SummarizeDepsInput = {
  repoRoot: string;
  manifest: ManifestEntry[];
};

export type SummarizeDepsOutput = {
  runtime: string[];
  dev: string[];
  tools: string[];
  pkgManagers: string[];
  scripts: Record<string, string>;
  notes: string[];
};

export type SummarizeRoutesInput = {
  repoRoot: string;
  manifest: ManifestEntry[];
  stack?: DetectStackOutput | { hits: StackHit[] };
};

export type SummarizeRoutesOutput = {
  routes: RouteEntry[];
  frameworksDetected: Array<RouteEntry['framework']>;
};

export type SummarizeArchitectureInput = {
  repoRoot: string;
  manifest: ManifestEntry[];
  stack?: DetectStackOutput;
  deps?: SummarizeDepsOutput;
  langProfile?: LangProfile;
};

export type SummarizeArchitectureOutput = {
  components: Component[];
  entrypoints: string[];
  configFiles: string[];
  dataFlowHints: string[];
  confidence: 'low' | 'medium' | 'high';
};

export type SummarizeTestsOutput = {
  frameworks: string[];
  runners: string[];
  assertionLibs: string[];
  scripts: Record<string, string>;
  locations: {
    patternsFound: string[];
    testDirs: string[];
    testFiles: number;
  };
  coverage: {
    source: 'coverage-summary.json' | 'lcov.info' | 'junit.xml' | null;
    linesPct?: number;
    statementsPct?: number;
    branchesPct?: number;
    functionsPct?: number;
    totals?: { tests?: number; failures?: number; skipped?: number };
  };
  status: {
    hasTests: boolean;
    notes: string[];
  };
};