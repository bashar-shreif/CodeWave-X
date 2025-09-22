import type { GraphState } from '../agent/state';
import { composeFinalReadme } from '../tools/compose-final-readme';

export const finalizeNode = async (
  s: GraphState,
): Promise<Partial<GraphState>> => {
  const sectionsMap: Record<string, string> = Array.isArray(s.draft?.sections)
    ? Object.fromEntries(
        (
          s.draft!.sections as Array<{
            id?: string;
            title?: string;
            body?: string;
          }>
        ).map((x, i) => [
          x.id || x.title || `section_${i + 1}`,
          String(x.body ?? ''),
        ]),
      )
    : (s.draft?.sections as Record<string, string>) || {};

  const out = await composeFinalReadme({
    repoRoot: s.repoRoot,
    draft: { title: s.draft?.title ?? '', sections: sectionsMap },
  });

  return { final: { markdown: out.markdown } } as any;
};
