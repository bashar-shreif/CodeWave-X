import type { GraphState } from "../agent/state";
import { summarizeDocs } from "../tools/summarize-docs";

export const docsNode = async (state: GraphState): Promise<GraphState> => {
  const { repoRoot } = state;
  if (!repoRoot) throw new Error("Docs: repoRoot is required");
  const docs = await summarizeDocs(repoRoot);
  return { ...state, docs };
};
