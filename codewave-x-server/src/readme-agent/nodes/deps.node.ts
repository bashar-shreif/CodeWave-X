import type { GraphState } from '../agent/state';
import { summarizeDependencies } from '../tools/summarize-dependencies';

export const depsNode = async (state: GraphState): Promise<GraphState> => {
  const { repoRoot, manifest } = state;
  if (!repoRoot) throw new Error('Deps: repoRoot is required');
  const deps = await summarizeDependencies({ repoRoot, manifest });
  return { ...state, deps };
};
