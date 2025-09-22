import type { GraphState } from '../agent/state';
import { summarizeSecurity } from '../tools/summarize-security';

export const securityNode = async (
  s: GraphState,
): Promise<Partial<GraphState>> => {
  const security = await summarizeSecurity(s.repoRoot);
  return { security };
};
