import type { GraphState } from '../agent/state';
import { composeFinalReadme } from '../tools/compose-final-readme';

export const finalizeNode = async (state: GraphState): Promise<GraphState> => {
  const sections = state.draft?.sections || {};
  const decisions = (state as any).draft?.decisions || {};
  const preferBadges: boolean =
    typeof decisions.preferBadges === 'boolean' ? decisions.preferBadges : true;
  const addTOC: boolean =
    typeof decisions.addTOC === 'boolean' ? decisions.addTOC : true;

  const final = await composeFinalReadme({
    repoRoot: state.repoRoot,
    draft: { title: '', sections },
    preferBadges,
    addTOC,
  });

  return { ...state, final };
};
