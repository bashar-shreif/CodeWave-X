import type { GraphState } from '../agent/state';
import { summarizeArchitecture } from '../tools/summarize-architecture';

export const architectureNode = async (
  state: GraphState,
): Promise<GraphState> => {
  const { repoRoot, manifest, stack, langProfile, deps } = state;
  if (!repoRoot) throw new Error('Architecture: repoRoot is required');

  const architecture = await summarizeArchitecture({
    repoRoot,
    manifest,
    stack,
    langProfile,
    deps,
  });

  return { ...state, architecture };
};
