import type { GraphState } from '../agent/state';
import { summarizeDocs } from '../tools/summarize-docs';

export const docsNode = async (s: GraphState): Promise<Partial<GraphState>> => {
  const docs = await summarizeDocs(s.repoRoot);
  return { docs };
};
