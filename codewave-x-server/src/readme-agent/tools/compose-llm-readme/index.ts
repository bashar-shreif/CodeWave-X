import axios from 'axios';
import { READMEA } from '../../agent/config';
import { retrieve } from '../../retrieval/retrieve.helper';
import { redact } from '../../retrieval/redact.util';

type DraftSections =
  | Record<string, string>
  | { id: string; title?: string; body: string }[];

export type ComposeLLMReadmeInput = {
  repoRoot: string;
  repoHash: string;
  draft: { sections: DraftSections };
  langProfile?: any;
  stack?: any;
  deps?: any;
  routes?: any;
  architecture?: any;
  tests?: any;
  config?: any;
  ci?: any;
  docs?: any;
  security?: any;
};

export const composeLLMReadme = async (input: ComposeLLMReadmeInput) => {
  const http = axios.create({
    baseURL: READMEA.OPENAI_BASE_URL.replace(/\/+$/, ''),
    headers: {
      authorization: `Bearer ${READMEA.OPENAI_API_KEY}`,
      'content-type': 'application/json',
      ...(process.env.OPENAI_ORG_ID
        ? { 'OpenAI-Organization': process.env.OPENAI_ORG_ID }
        : {}),
      ...(process.env.OPENAI_PROJECT
        ? { 'OpenAI-Project': process.env.OPENAI_PROJECT }
        : {}),
    },
    timeout: READMEA.LLM_TIMEOUT_MS,
  });

  const secEntries: [string, string][] = Array.isArray(input.draft.sections)
    ? input.draft.sections.map((s) => [s.id, s.body] as [string, string])
    : Object.entries(input.draft.sections);

  const queries = [
    'project overview',
    'installation and quickstart',
    'tech stack and frameworks',
    'routes and APIs',
    'architecture and components',
    'configuration and environment',
    'testing and CI',
    'docs and usage',
    'security considerations',
    ...secEntries.map(([k, v]) => `${k}: ${v.slice(0, 180)}`),
  ].slice(0, 18);

  const snippets: string[] = [];
  for (const q of queries) {
    const r = await retrieve({
      repoHash: input.repoHash,
      repoRoot: input.repoRoot,
      query: q,
      k: 3,
      maxChars: 800,
    });
    for (const p of r.passages) {
      if (snippets.length < 24) snippets.push(p.body);
    }
    if (snippets.length >= 24) break;
  }

  const sys = [
    'You are a senior engineer who writes production-grade READMEs.',
    'Write a complete README in Markdown for this repository.',
    'Use the provided state and snippets as factual grounding.',
    'If the state indicates a monorepo, produce a parent README that lists each app with a brief summary and quickstart pointers.',
    'Avoid secrets, tokens, and absolute filesystem paths.',
    'Prefer concise, accurate, practical instructions.',
  ].join(' ');

  const state = {
    langProfile: input.langProfile,
    stack: input.stack,
    deps: input.deps,
    routes: input.routes,
    architecture: input.architecture,
    tests: input.tests,
    config: input.config,
    ci: input.ci,
    docs: input.docs,
    security: input.security,
  };

  const draft = input.draft;

  const payload = {
    model: READMEA.LLM_MODEL,
    temperature: 0.2,
    messages: [
      { role: 'system', content: sys },
      {
        role: 'user',
        content: JSON.stringify({
          draft,
          state,
          snippets,
          requirements: {
            headings: [
              'Overview',
              'Tech Stack',
              'Architecture',
              'Getting Started',
              'Configuration',
              'Running',
              'Testing',
              'CI',
              'Security',
              'Documentation',
              'Contributing',
              'License',
            ],
            monorepo_note:
              'If multiple apps exist, include an Apps section with a table: {App, Stack, Languages, Routes, Path}.',
          },
        }),
      },
    ],
  };

  const res = await http.post('/chat/completions', payload);
  let md: string = res?.data?.choices?.[0]?.message?.content ?? '';
  md = redact(md);
  return { markdown: md };
};
