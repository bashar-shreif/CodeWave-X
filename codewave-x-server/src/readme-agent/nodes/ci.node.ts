import type { GraphState } from '../agent/state';
import { summarizeCI } from '../tools/summarize-ci';

export const ciNode = async (state: GraphState): Promise<GraphState> => {
  const { repoRoot } = state;
  if (!repoRoot) throw new Error('CI: repoRoot is required');
  const ci = await summarizeCI(repoRoot);
  return { ...state, ci };
};
