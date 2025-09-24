import { buildEmbeddings } from '../tools/build-embeddings';
import { embedIndexPathFor } from '../agent/config';
import * as fs from 'fs';

export const buildEmbeddingsNode = async (s: any) => {
  if (!s?.repoRoot || !s?.repoHash) return {};
  const indexPath = embedIndexPathFor(s.repoHash);
  const exists = fs.existsSync(indexPath);
  await buildEmbeddings({
    repoRoot: s.repoRoot,
    repoHash: s.repoHash,
    force: !exists,
  });
  return {};
};
