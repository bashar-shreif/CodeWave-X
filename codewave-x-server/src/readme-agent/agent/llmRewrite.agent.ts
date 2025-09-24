import axios from 'axios';
import { READMEA } from './config';
import { retrieve } from '../retrieval/retrieve.helper';
import { redact } from '../retrieval/redact.util';

type AnySections = Record<string, string>;

export async function rewriteSectionsWithLLM<T extends AnySections>(args: {
  repoRoot: string;
  repoHash: string;
  sections: T;
}): Promise<T> {
  if (!READMEA.USE_LLM) return args.sections;

  const http = axios.create({
    baseURL: READMEA.OPENAI_BASE_URL.replace(/\/+$/, ''),
    headers: {
      authorization: `Bearer ${READMEA.OPENAI_API_KEY}`,
      'content-type': 'application/json',
      ...(process.env.OPENAI_ORG_ID ? { 'OpenAI-Organization': process.env.OPENAI_ORG_ID } : {}),
      ...(process.env.OPENAI_PROJECT ? { 'OpenAI-Project': process.env.OPENAI_PROJECT } : {}),
    },
    timeout: READMEA.LLM_TIMEOUT_MS,
  });

  const out = { ...(args.sections as AnySections) } as T;

  for (const [id, base] of Object.entries(args.sections)) {
    try {
      const q = `Evidence for README "${id}": ${base.slice(0, 240)}`;
      const ctx = await retrieve({ repoHash: args.repoHash, repoRoot: args.repoRoot, query: q, k: 6, maxChars: 1200 });

      const sys = [
        'You are a precise technical writer.',
        `Hard cap ${READMEA.LLM_MAX_SECTION_CHARS} characters.`,
        'No secrets, keys, endpoints, or absolute paths.',
        'Return JSON: {"id":"<section id>","body":"<markdown>"}',
      ].join(' ');

      const user = { id, draft: base, snippets: ctx.passages.map(p => p.body).slice(0, 6) };

      const res = await http.post('/chat/completions', {
        model: READMEA.LLM_MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify(user) }],
      });

      const txt: string = res?.data?.choices?.[0]?.message?.content ?? '';
      const body = safeBody(id, txt) ?? base;
      const red = redact(body).slice(0, READMEA.LLM_MAX_SECTION_CHARS);

      (out as AnySections)[id] = red;
    } catch {
      (out as AnySections)[id] = base;
    }
  }
  return out;
}

const safeBody = (id: string, s: string): string | null => {
  try {
    const j = JSON.parse(s);
    const okId = typeof j?.id === 'string' ? j.id : id;
    const body = typeof j?.body === 'string' ? j.body : null;
    return okId && body ? body : null;
  } catch { return null; }
};
