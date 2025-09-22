import type { GraphState } from '../agent/state';
import { summarizeTests } from '../tools/summarize-tests';

export const testsNode = async (state: GraphState): Promise<GraphState> => {
  const { repoRoot } = state;
  if (!repoRoot) throw new Error('Tests: repoRoot is required');

  const tests = await summarizeTests(repoRoot);
  return { ...state, tests };
};
