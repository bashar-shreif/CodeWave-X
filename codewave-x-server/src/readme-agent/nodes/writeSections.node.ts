import type { GraphState } from "../agent/state";
import { writeSectionsAgent } from "../agent/writeSections.agent";

export const writeSectionsNode = async (s: GraphState): Promise<Partial<GraphState>> => {
  const out = await writeSectionsAgent({
    repoRoot: s.repoRoot,
    repoHash: s.repoHash,
    manifest: s.manifest,
    langProfile: s.langProfile,
    stack: s.stack,
    deps: s.deps,
    routes: s.routes,
    architecture: s.architecture,
    tests: s.tests,
    config: s.config,
    ci: s.ci,
    docs: s.docs,
    security: s.security,
    descriptionHint: (s as any).descriptionHint,
    projectName: (s as any).projectName,
  });

  return { draft: { sections: out.sections, decisions: out.decisions } as any };
};
