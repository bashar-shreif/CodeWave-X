import type { GraphState } from '../agent/state';
import { summarizeTests } from '../tools/summarize-tests';

export const testsNode = async (
  s: GraphState,
): Promise<Partial<GraphState>> => {
  const tests = await summarizeTests(s.repoRoot);
  return { tests };
};
