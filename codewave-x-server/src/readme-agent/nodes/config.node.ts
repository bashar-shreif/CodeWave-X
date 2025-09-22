import type { GraphState } from '../agent/state';
import { summarizeConfig } from '../tools/summarize-config';

export const configNode = async (state: GraphState): Promise<GraphState> => {
  const { repoRoot } = state;
  if (!repoRoot) throw new Error('Config: repoRoot is required');

  const config = await summarizeConfig(repoRoot);
  return { ...state, config };
};
