import type { GraphState } from '../agent/state';
import { scanLanguages } from '../tools/scan-languages';
import { detectStack } from '../tools/detect-stacks';

export const scanNode = async (s: GraphState): Promise<Partial<GraphState>> => {
  const langProfile = await scanLanguages({
    repoRoot: s.repoRoot,
    manifest: s.manifest,
  });
  const stack = await detectStack({
    repoRoot: s.repoRoot,
    manifest: s.manifest,
  });
  return { langProfile, stack };
};
