import { writeSectionsAgent } from '../agent/writeSections.agent';
import { rewriteSectionsWithLLM } from '../agent/llmRewrite.agent';
import { READMEA } from '../agent/config';

export const writeSectionsNode = async (s: any) => {
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
  });

  const baseSections = out.sections;
  const finalSections = READMEA.USE_LLM
    ? await rewriteSectionsWithLLM<typeof baseSections>({
        repoRoot: s.repoRoot,
        repoHash: s.repoHash,
        sections: baseSections,
      })
    : baseSections;

  return {
    draft: { sections: finalSections, decisions: out.decisions } as any,
  };
};
