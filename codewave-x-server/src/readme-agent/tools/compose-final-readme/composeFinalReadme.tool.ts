import {
  pickPkgMeta,
  clean,
  makeBadges,
  makeTOC,
  mapSections,
  orderSections,
  dedupeLines,
} from './composeHelpers';
import {
  ComposeFinalReadmeInput,
  ComposeFinalReadmeOutput,
} from 'src/readme-agent/types/io.type';

export const composeFinalReadme = async (
  input: ComposeFinalReadmeInput,
): Promise<ComposeFinalReadmeOutput> => {
  const meta = await pickPkgMeta(input.repoRoot);
  const title = clean(input.draft.title || meta.name || 'Project');
  const sections = mapSections(input.draft);

  if (input.preferBadges) {
    const badges = makeBadges(meta);
    if (badges) sections['Badges'] = badges;
  }

  const outline = orderSections(sections);
  if (input.addTOC && outline.length > 2) {
    const toc = makeTOC(outline);
    if (toc) sections['Table of Contents'] = toc;
  }

  const ordered = orderSections(sections);
  const parts: string[] = [];
  parts.push(`# ${title}`);
  if (sections['Badges']) {
    parts.push(`\n${sections['Badges']}\n`);
  }
  if (sections['Table of Contents']) {
    parts.push(`\n## Table of Contents\n${sections['Table of Contents']}`);
  }
  for (const key of ordered) {
    if (key === 'Badges' || key === 'Table of Contents') continue;
    parts.push(`\n## ${key}\n\n${sections[key]}`);
  }

  const markdown = dedupeLines(
    parts.join('\n').replace(/\n{3,}/g, '\n\n'),
  ).trim();

  return {
    title,
    outline: ordered,
    sections,
    markdown,
  };
};
