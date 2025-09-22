import type { GraphState } from '../agent/state';
import { summarizeCI } from '../tools/summarize-ci';

export const ciNode = async (s: GraphState): Promise<Partial<GraphState>> => {
  const ci = await summarizeCI(s.repoRoot);
  return { ci };
};
