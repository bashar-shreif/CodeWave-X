export type IndexChunk = {
  id: string;
  rel: string;
  start: number;
  end: number;
  lang?: string;
  sha1: string;
  v: number[];
};

export type EmbedIndex = {
  version: 1;
  repoHash: string;
  model: string;
  dim: number;
  chunks: IndexChunk[];
  stats: { files: number; chunks: number; bytes: number };
};
