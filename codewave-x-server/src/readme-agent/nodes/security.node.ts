import type { GraphState } from '../agent/state';
import { summarizeSecurity } from '../tools/summarize-security';

export const securityNode = async (state: GraphState): Promise<GraphState> => {
  if (!state.repoRoot) throw new Error('Security: repoRoot is required');
  const security = await summarizeSecurity(state.repoRoot);
  return { ...state, security };
};
