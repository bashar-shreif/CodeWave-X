import path from 'path';
import type { GraphState } from '../agent/state';
import { listFiles } from '../tools/list-files';

export const ingestRepoNode = async (
  state: GraphState,
): Promise<Partial<GraphState>> => {
  const { manifest, repoHash } = await listFiles({
    repoUri: path.resolve(state.repoRoot),
  });
  return { manifest, repoHash };
};
