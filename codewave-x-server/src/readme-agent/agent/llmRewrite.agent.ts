import axios from 'axios';
import { READMEA } from './config';
import { retrieve } from '../retrieval/retrieve.helper';
import { redact } from '../retrieval/redact.util';

type Sections = Record<string, string>;

export const rewriteSectionsWithLLM = async (args: {
  repoRoot: string;
  repoHash: string;
  sections: Sections;
}): Promise<Sections> => {
  if (!READMEA.USE_LLM) return args.sections;

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

  const out: Sections = {};
  const entries = Object.entries(args.sections);

  for (const [id, base] of entries) {
    try {
      const q = mkQuery(id, base);
      const ctx = await retrieve({
        repoHash: args.repoHash,
        query: q,
        k: 6,
        maxChars: 1200,
        repoRoot: args.repoRoot,
      });

      const sys = [
        'You are a precise technical writer.',
        'Task: rewrite one README section in clear markdown.',
        `Hard cap ${READMEA.LLM_MAX_SECTION_CHARS} characters.`,
        'Do not include secrets, API keys, endpoints, or absolute paths.',
        'If unsure, keep the safe draft text.',
        'Return a strict JSON object: {"id": "<section id>", "body": "<markdown>"}',
      ].join(' ');

      const user = {
        id,
        draft: base,
        snippets: ctx.passages.map((p) => p.body).slice(0, 6),
        rules: {
          cap: READMEA.LLM_MAX_SECTION_CHARS,
          no_secrets: true,
          no_paths: true,
        },
      };

      const res = await http.post('/chat/completions', {
        model: READMEA.LLM_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: JSON.stringify(user) },
        ],
        temperature: 0.2,
      });

      const txt: string = res?.data?.choices?.[0]?.message?.content ?? '';

      let body = safeParseBody(id, txt) ?? base;
      body = redact(body);
      if (body.length > READMEA.LLM_MAX_SECTION_CHARS) {
        body = body.slice(0, READMEA.LLM_MAX_SECTION_CHARS);
      }

      out[id] = body;
    } catch {
      out[id] = base;
    }
  }

  return out;
};

const mkQuery = (id: string, draft: string) =>
  `Evidence for README "${id}": ${draft.slice(0, 240)}`;

const safeParseBody = (id: string, s: string): string | null => {
  try {
    const j = JSON.parse(s);
    const body = typeof j?.body === 'string' ? j.body : null;
    const okId = typeof j?.id === 'string' ? j.id : id;
    return body && okId ? body : null;
  } catch {
    return null;
  }
};
