import path from 'path';
import { DocItem } from 'src/readme-agent/types/docItem.type';
import { SummarizeDocsOutput } from 'src/readme-agent/types/io.type';
import {
  walk,
  parseOpenApi,
  pathExists,
  readText,
  rel,
  isMarkdown,
  isOpenApiName,
  extractHeadings,
  extractSummary,
  extractTitle,
  detectTopicHits,
} from './docsHelpers';

export const summarizeDocs = async (
  repoRoot: string,
): Promise<SummarizeDocsOutput> => {
  const files = await walk(repoRoot);
  const items: DocItem[] = [];
  const docsDirs: string[] = [];
  const siteGenerators = new Set<string>();
  const openapiList: Array<{
    path: string;
    title?: string;
    version?: string;
    endpoints?: number;
  }> = [];
  const adrs: Array<{ path: string; title?: string }> = [];
  let rootReadme: string | undefined;
  let storybook: SummarizeDocsOutput['index']['storybook'] = {
    present: false,
    stories: 0,
    configPath: undefined,
  };

  if (await pathExists(path.join(repoRoot, 'mkdocs.yml')))
    siteGenerators.add('mkdocs');
  if (
    (await pathExists(path.join(repoRoot, 'docusaurus.config.js'))) ||
    (await pathExists(path.join(repoRoot, 'docusaurus.config.ts')))
  )
    siteGenerators.add('docusaurus');
  if (
    (await pathExists(path.join(repoRoot, 'docs/.vuepress/config.js'))) ||
    (await pathExists(path.join(repoRoot, 'docs/.vuepress/config.ts')))
  )
    siteGenerators.add('vuepress');

  const sbDir = path.join(repoRoot, '.storybook');
  if (await pathExists(sbDir)) {
    storybook = {
      present: true,
      stories: files.filter((f) =>
        /\.stories\.[jt]sx?$|\.stories\.mdx$/i.test(f),
      ).length,
      configPath: rel(repoRoot, sbDir),
    };
    items.push({
      path: rel(repoRoot, sbDir),
      kind: 'storybook',
      title: 'Storybook config',
    });
  }

  const candidateDirs = new Set<string>();
  for (const f of files) {
    const rp = rel(repoRoot, f);
    const parts = rp.split(path.sep);
    if (
      parts[0].toLowerCase() === 'docs' ||
      parts[0].toLowerCase() === 'documentation'
    )
      candidateDirs.add(parts[0]);
  }
  docsDirs.push(...Array.from(candidateDirs).sort());

  const rootCandidates = [
    'README.md',
    'README.MD',
    'readme.md',
    'README.mdx',
    'CONTRIBUTING.md',
    'CONTRIBUTING.mdx',
    'CHANGELOG.md',
    'CHANGELOG.mdx',
    'LICENSE',
    'LICENSE.md',
    'LICENSE.txt',
  ];
  for (const c of rootCandidates) {
    const abs = path.join(repoRoot, c);
    if (!(await pathExists(abs))) continue;
    const txt = await readText(abs);
    const md = txt || '';
    const headings = isMarkdown(c) ? extractHeadings(md) : undefined;
    const title = isMarkdown(c) ? extractTitle(md) || c : c;
    const summary = isMarkdown(c) ? extractSummary(md) : undefined;
    let kind: DocItem['kind'] = 'other';
    if (/^readme/i.test(c)) kind = 'readme';
    if (/^contributing/i.test(c)) kind = 'contributing';
    if (/^changelog/i.test(c)) kind = 'changelog';
    if (/^license/i.test(c)) kind = 'license';
    const item: DocItem = { path: c, kind, title, headings, summary };
    items.push(item);
    if (kind === 'readme') rootReadme = c;
  }

  for (const abs of files) {
    const rp = rel(repoRoot, abs);
    const bn = path.basename(abs);
    const ext = path.extname(bn).toLowerCase();

    // OpenAPI
    if (isOpenApiName(bn)) {
      const meta = await parseOpenApi(abs);
      openapiList.push({ path: rp, ...(meta || {}) });
      items.push({
        path: rp,
        kind: 'openapi',
        title: meta?.title || bn,
        meta: meta ?? undefined,
      });
    }

    if (
      /(^|\/)(adr|adrs|architecture-?decision-?records?)(\/|$)/i.test(rp) ||
      /^\d{4}-.*\.md$/i.test(bn)
    ) {
      if (isMarkdown(bn)) {
        const md = (await readText(abs)) || '';
        const title = extractTitle(md) || bn.replace(/\.mdx?$/i, '');
        adrs.push({ path: rp, title });
        items.push({
          path: rp,
          kind: 'adr',
          title,
          headings: extractHeadings(md),
          summary: extractSummary(md),
        });
        continue;
      }
    }

    if (
      isMarkdown(bn) &&
      /(docs|documentation|guides?|tutorials?|design|specs?)/i.test(rp)
    ) {
      const md = (await readText(abs)) || '';
      const title = extractTitle(md) || bn.replace(/\.mdx?$/i, '');
      let kind: DocItem['kind'] = 'docsPage';
      if (/guide/i.test(rp)) kind = 'guide';
      if (/tutorial/i.test(rp)) kind = 'tutorial';
      if (/design|spec/i.test(rp)) kind = 'design';
      items.push({
        path: rp,
        kind,
        title,
        headings: extractHeadings(md),
        summary: extractSummary(md),
      });
      continue;
    }

    if (isMarkdown(bn) && /\b(api|reference|endpoints)\b/i.test(rp)) {
      const md = (await readText(abs)) || '';
      const title = extractTitle(md) || bn.replace(/\.mdx?$/i, '');
      items.push({
        path: rp,
        kind: 'api',
        title,
        headings: extractHeadings(md),
        summary: extractSummary(md),
      });
      continue;
    }
  }

  const topicsInit = {
    setup: { present: false, sources: [] as string[] },
    usage: { present: false, sources: [] as string[] },
    contributing: { present: false, sources: [] as string[] },
    architecture: { present: false, sources: [] as string[] },
    api: { present: false, sources: [] as string[] },
    changelog: { present: false, sources: [] as string[] },
    license: { present: false, sources: [] as string[] },
    security: { present: false, sources: [] as string[] },
    testing: { present: false, sources: [] as string[] },
  };

  for (const it of items) {
    const title = it.title || '';
    const headings = it.headings || [];
    const body = it.summary || '';
    const hits = detectTopicHits(title, headings, body);
    Object.entries(hits).forEach(([k, v]) => {
      if (v) {
        (topicsInit as any)[k].present = true;
        (topicsInit as any)[k].sources.push(it.path);
      }
    });
  }

  const mdFiles = items.filter(
    (i) =>
      i.path.toLowerCase().endsWith('.md') ||
      i.path.toLowerCase().endsWith('.mdx'),
  ).length;
  const docFiles = items.length;

  const notes: string[] = [];
  if (!rootReadme) notes.push('No root README.md found');
  if (openapiList.length === 0) notes.push('No OpenAPI files detected');
  if (adrs.length === 0) notes.push('No ADRs detected');
  if (docsDirs.length === 0) notes.push('No /docs directory detected');

  return {
    files: items.sort((a, b) => a.path.localeCompare(b.path)),
    index: {
      rootReadme,
      docsDirs,
      siteGenerators: [...siteGenerators].sort(),
      storybook,
      openapi: openapiList.sort((a, b) => a.path.localeCompare(b.path)),
      adrs: adrs.sort((a, b) => a.path.localeCompare(b.path)),
    },
    topics: topicsInit,
    stats: { mdFiles, docFiles },
    status: { hasDocs: docFiles > 0, notes },
  };
};
