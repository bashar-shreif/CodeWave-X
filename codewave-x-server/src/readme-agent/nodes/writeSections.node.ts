import type { GraphState } from '../agent/state';
import { writeSectionsAgent } from '../agent/writeSections.agent';

export const writeSectionsNode = async (
  state: GraphState,
): Promise<GraphState> => {
  const out = await writeSectionsAgent({
    repoRoot: state.repoRoot,
    repoHash: state.repoHash,
    manifest: state.manifest,
    langProfile: state.langProfile,
    stack: state.stack,
    deps: state.deps,
    routes: state.routes,
    architecture: state.architecture,
    tests: state.tests,
    config: state.config,
    ci: state.ci,
    docs: state.docs,
    security: state.security,
  });
  return {
    ...state,
    draft: { sections: out.sections, decisions: out.decisions } as any,
  };
};
