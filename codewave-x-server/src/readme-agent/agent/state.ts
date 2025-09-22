type ProjectUri = string;
type ArtifactUri = string;

type Manifest = { files: Array<{ path: string; hash: string; size: number }> };
type LangProfile = {
  byLanguage: Record<string, { files: number; loc: number }>;
};
type StackProfile = { frameworks: string[]; runtimes: string[]; dbs: string[] };
type Metrics = {
  totals: {
    files: number;
    classes: number;
    functions: number;
    imports: number;
    variables: number;
  };
};
type DepGraph = { mmdUri?: ArtifactUri; dotUri?: ArtifactUri };
type ChunksMeta = { count: number; byLang: Record<string, number> };
type IndexInfo = { indexId: string; upserted: number };
type Snippet = { path: string; start: number; end: number; text: string };
type Outline = {
  sections: Array<{ id: string; title: string; bullets: string[] }>;
};

type Result = {
  artifacts: ArtifactUri[];
  errors: Array<{ step: string; message: string }>;
  progress: number;
  cancelled: boolean;
  readmeUri?: ArtifactUri;
};

export type AgentState = {
  jobId: string;
  project: ProjectUri;
  options?: { maxFiles?: number; embedModel?: string };

  manifest?: Manifest;
  langProfile?: LangProfile;
  stackProfile?: StackProfile;
  metrics?: Metrics;

  chunksMeta?: ChunksMeta;
  indexInfo?: IndexInfo;

  evidence?: Snippet[];
  outline?: Outline;
  readmeUri?: ArtifactUri;

  exec: Result;
};
