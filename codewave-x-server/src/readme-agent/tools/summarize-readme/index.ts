import {
  SummarizeReadmeInput,
  SummarizeReadmeOutput,
} from '../../types/tools/io.type';
import {
  deriveName,
  mkArchitecture,
  mkCI,
  mkConfig,
  mkDocs,
  mkFeatures,
  mkGettingStarted,
  mkRoutes,
  mkSecurity,
  mkTechStack,
  mkTesting,
  pickPkgMgr,
  assemble,
} from './helpers';

export const summarizeReadme = async (
  input: SummarizeReadmeInput,
): Promise<SummarizeReadmeOutput> => {
  const name = await deriveName(input.repoRoot, input.projectName);
  const desc =
    input.descriptionHint ||
    'Project README draft generated from repository signals.';
  const sections: Record<string, string> = {};
  sections['Description'] = desc;
  const tech = mkTechStack(input.stack, input.langProfile, input.deps);
  if (tech) sections['Tech Stack'] = tech;
  const feats = mkFeatures(input.architecture);
  if (feats) sections['Features'] = feats;
  sections['Architecture'] = mkArchitecture(input.architecture);
  sections['Getting Started'] = mkGettingStarted(input.deps);
  sections['Routes'] = mkRoutes(input.routes);
  sections['Configuration'] = mkConfig(input.config);
  sections['Testing'] = mkTesting(input.tests);
  sections['CI'] = mkCI(input.ci);
  sections['Documentation'] = mkDocs(input.docs);
  sections['Security'] = mkSecurity(input.security);

  // Optional stubs based on docs topics
  if (input.docs?.topics?.license?.present)
    sections['License'] = 'See `LICENSE`.';
  if (input.docs?.topics?.contributing?.present)
    sections['Contributing'] = 'See `CONTRIBUTING.md`.';

  const asm = assemble(name, sections);
  return {
    title: name,
    outline: asm.outline,
    sections,
    markdown: asm.markdown,
  };
};

export default summarizeReadme;
