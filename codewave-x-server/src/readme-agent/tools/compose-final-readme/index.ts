import { inferTitle, pickLicense, renderSections, renderTOC } from './helpers';
import {
  ComposeFinalReadmeInput,
  ComposeFinalReadmeOutput,
} from 'src/readme-agent/types/tools/io.type';

export const composeFinalReadme = async (
  input: ComposeFinalReadmeInput,
): Promise<ComposeFinalReadmeOutput> => {
  const { repoRoot, draft, preferBadges = false, addTOC = true } = input;

  const inferred = await inferTitle(repoRoot);
  const title = (draft.title?.trim() || inferred.title || 'Project').replace(
    /^#+\s*/,
    '',
  );
  const licenseFile = await pickLicense(repoRoot);

  const badges: string[] = [];
  if (preferBadges && licenseFile) {
    badges.push(
      `[![License](https://img.shields.io/badge/license-${encodeURIComponent('LICENSE')}-informational)](#license)`,
    );
  }

  const toc = addTOC ? renderTOC(draft.sections) : '';
  const { md: body, order } = renderSections(draft.sections);

  const headerLines = [`# ${title}`];
  if (badges.length) headerLines.push(badges.join(' '));

  const markdown =
    [headerLines.join('\n'), '', toc, body]
      .filter(Boolean)
      .join('\n')
      .replace(/\s+$/s, '') + '\n';

  return {
    markdown,
    title,
    sectionsOrder: order,
    meta: { inferredTitle: inferred.title, license: licenseFile, badges },
  };
};
