import { ManifestEntry } from './manifest.type';
import type { StackHit } from './stackHit.type';
import { StatBlock } from './statBlock.type';
import { RouteEntry } from './routeEntry.type';
import { Component } from './component.type';
import { LangProfile } from './langProfile.type';
import { CIWorkflow } from './ciWorkflow.type';
import { DocItem } from './docItem.type';
import { SecretHit } from './secureHit.type';
import { Draft } from './draft.type';

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

export type SummarizeConfigOutput = {
  bundlers: string[]; // Vite, Webpack, Rollup, esbuild, tsup
  builders: string[]; // Next, Nuxt, Angular, SvelteKit, Astro
  linters: string[]; // ESLint
  formatters: string[]; // Prettier
  cssTools: string[]; // Tailwind, PostCSS
  monoRepo: {
    managers: string[]; // Turborepo, Nx, Lerna, pnpm workspaces, Yarn workspaces
    workspaces: boolean;
    workspaceGlobs?: string[];
  };
  ts: {
    enabled: boolean;
    target?: string;
    module?: string;
    jsx?: string;
    strict?: boolean;
    paths?: Record<string, string[]>;
    tsconfigPath?: string;
  };
  eslint: {
    present: boolean;
    configPaths: string[];
  };
  prettier: {
    present: boolean;
    configPaths: string[];
  };
  configsFound: string[]; // relative paths
  notes: string[];
};

export type SummarizeCIOutput = {
  providers: string[];
  files: string[];
  workflows: CIWorkflow[];
  languages: {
    node?: string[];
    python?: string[];
    php?: string[];
    java?: string[];
    go?: string[];
    dotnet?: string[];
    ruby?: string[];
  };
  secrets: string[];
  caching: string[];
  status: { hasCI: boolean; notes: string[] };
};

export type SummarizeDocsOutput = {
  files: DocItem[];
  index: {
    rootReadme?: string;
    docsDirs: string[];
    siteGenerators: string[]; // mkdocs, docusaurus, vuepress
    storybook?: { present: boolean; stories: number; configPath?: string };
    openapi: Array<{
      path: string;
      title?: string;
      version?: string;
      endpoints?: number;
    }>;
    adrs: Array<{ path: string; title?: string }>;
  };
  topics: Record<string, { present: boolean; sources: string[] }>;
  stats: { mdFiles: number; docFiles: number };
  status: { hasDocs: boolean; notes: string[] };
};

export type SummarizeSecurityOutput = {
  libs: {
    security: string[];
    auth: string[];
    crypto: string[];
    scanners: string[];
  };
  env: { files: string[]; examples: string[]; gitignoreProtectsEnv: boolean };
  sensitiveFiles: string[]; // pem/keys/p12/jks/service accounts
  secretMatches: SecretHit[]; // redacted counts only
  policies: { corsWildcard: string[]; debugTrue: string[] };
  ciSecurity: string[]; // codeql, gitleaks, semgrep, snyk
  status: { riskScore: number; notes: string[] };
};

export type SummarizeReadmeInput = {
  repoRoot: string;
  projectName?: string;
  descriptionHint?: string;
  manifest?: any;
  langProfile?: any;
  stack?: any;
  deps?: any;
  routes?: any;
  architecture?: any;
  tests?: any;
  config?: any;
  ci?: any;
  docs?: any;
  security?: any;
};

export type SummarizeReadmeOutput = {
  title: string;
  outline: string[];
  sections: Record<string, string>;
  markdown: string;
};

export type ComposeFinalReadmeInput = {
  repoRoot: string;
  draft: { title?: string; sections: Record<string, string> };
  preferBadges?: boolean;
  addTOC?: boolean;
};

export type ComposeFinalReadmeOutput = {
  markdown: string;
  title: string;
  sectionsOrder: string[];
  meta: {
    inferredTitle?: string | null;
    license?: string | null;
    badges: string[];
  };
};

export type BuildEmbeddingsInput = {
  repoRoot: string;
  repoHash: string;
  force?: boolean;
};

export type BuildEmbeddingsOutput = {
  indexPath: string;
  stats: { files: number; chunks: number; dim: number };
};
