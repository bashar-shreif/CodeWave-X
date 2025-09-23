import { READMEA } from '../agent/config';
import { buildEmbeddings } from '../tools/build-embeddings';

export const buildEmbeddingsNode = async (s: any) => {
  if (!READMEA.USE_LLM) return {};
  if (!s?.repoRoot || !s?.repoHash) return {};
  await buildEmbeddings({
    repoRoot: s.repoRoot,
    repoHash: s.repoHash,
    force: false,
  });
  return {};
};
