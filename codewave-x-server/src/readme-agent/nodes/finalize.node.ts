import { composeFinalReadme } from '../tools/compose-final-readme';
import { composeLLMReadme } from '../tools/compose-llm-readme';
import { READMEA } from '../agent/config';

export const finalizeNode = async (s: any) => {
  if (READMEA.USE_LLM) {
    const { markdown } = await composeLLMReadme({
      repoRoot: s.repoRoot,
      repoHash: s.repoHash,
      draft: { sections: s.draft?.sections || {} },
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
    return { final: { markdown } };
  }

  const res = await composeFinalReadme({
    repoRoot: s.repoRoot,
    draft: { title: '', sections: s.draft?.sections || {} },
  });
  return { final: { markdown: res.markdown } };
};
