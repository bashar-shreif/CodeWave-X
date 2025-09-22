import path from 'path';
import type { GraphState } from '../agent/state';
import { listFiles } from '../tools/list-files'; // adjust if needed

export const ingestRepoNode = async (
  state: GraphState,
): Promise<GraphState> => {
  const { repoRoot } = state;
  if (!repoRoot) throw new Error('IngestRepo: repoRoot is required');
  const repoUri = path.resolve(repoRoot);

  const { manifest, repoHash } = await listFiles({ repoUri });
  return { ...state, manifest, repoHash };
};
