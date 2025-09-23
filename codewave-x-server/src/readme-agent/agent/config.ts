import * as path from 'path';

export type EmbedBackend = 'file' | 'chroma';

const int = (v: any, d: number) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : d;
};

export const READMEA = {
  USE_LLM: process.env.AGENT_USE_LLM === '1',

  TIMEOUT_MS: int(process.env.READMEA_TIMEOUT_MS, 90_000),

  LLM_MODEL: process.env.READMEA_LLM_MODEL || 'gpt-4o-mini',
  LLM_MAX_SECTION_CHARS: int(process.env.READMEA_LLM_MAX_SECTION_CHARS, 600),
  LLM_TIMEOUT_MS: int(process.env.READMEA_LLM_TIMEOUT_MS, 20_000),

  EMBED_BACKEND: (process.env.READMEA_EMBED_BACKEND as EmbedBackend) || 'file',
  EMBED_MODEL: process.env.READMEA_EMBED_MODEL || 'text-embedding-3-large',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

  EMBED_MAX_REPO_BYTES: int(
    process.env.READMEA_EMBED_MAXBYTES,
    50 * 1024 * 1024,
  ),
  EMBED_MAX_FILE_BYTES: int(process.env.READMEA_EMBED_MAXFILEBYTES, 512 * 1024),

  EMBED_TARGET_CHARS: int(process.env.READMEA_EMBED_TARGET_CHARS, 1400),
  EMBED_OVERLAP_CHARS: int(process.env.READMEA_EMBED_OVERLAP_CHARS, 200),

  CHROMA_URL: process.env.CHROMA_URL || 'http://localhost:8000',

  ARTIFACTS_ROOT: process.env.READMEA_ARTIFACTS_ROOT || 'artifacts',
} as const;

export const artifactsDirFor = (repoHash: string) =>
  path.join(READMEA.ARTIFACTS_ROOT, repoHash);

export const embedIndexPathFor = (repoHash: string) =>
  path.join(artifactsDirFor(repoHash), 'embed', 'index.json');

export const agentConfig = {
  useLLM: process.env.AGENT_USE_LLM === '1',
  maxRepairLoops: 2,
  stepTimeoutMs: 10_000,
  sectionCharCap: 600,
  bannedPhrases: [/probably/i, /guess/i],
} as const;
