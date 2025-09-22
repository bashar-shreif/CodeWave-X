import type { GraphState } from '../agent/state';
import { summarizeDependencies } from '../tools/summarize-dependencies';

export const depsNode = async (s: GraphState): Promise<Partial<GraphState>> => {
  const deps = await summarizeDependencies({
    repoRoot: s.repoRoot,
    manifest: s.manifest,
  });
  return { deps };
};
