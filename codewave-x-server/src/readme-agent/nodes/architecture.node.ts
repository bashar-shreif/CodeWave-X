import type { GraphState } from '../agent/state';
import { summarizeArchitecture } from '../tools/summarize-architecture';

export const architectureNode = async (
  s: GraphState,
): Promise<Partial<GraphState>> => {
  const architecture = await summarizeArchitecture({
    repoRoot: s.repoRoot,
    manifest: s.manifest,
    stack: s.stack,
    langProfile: s.langProfile,
    deps: s.deps,
  });
  return { architecture };
};
