import type { GraphState } from '../agent/state';
import { summarizeConfig } from '../tools/summarize-config';

export const configNode = async (
  s: GraphState,
): Promise<Partial<GraphState>> => {
  const config = await summarizeConfig(s.repoRoot);
  return { config };
};
