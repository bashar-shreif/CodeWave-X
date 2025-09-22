import type { GraphState } from '../agent/state';
import { composeFinalReadme } from '../tools/compose-final-readme';

export const finalizeNode = async (
  s: GraphState,
): Promise<Partial<GraphState>> => {
  const final = await composeFinalReadme({
    repoRoot: s.repoRoot,
    draft: { title: '', sections: s.draft?.sections || {} },
    preferBadges: (s as any).draft?.decisions?.preferBadges ?? true,
    addTOC: (s as any).draft?.decisions?.addTOC ?? true,
  });
  return { final };
};
