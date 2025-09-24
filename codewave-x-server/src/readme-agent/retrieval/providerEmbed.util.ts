import axios from 'axios';
import { READMEA } from '../agent/config';

export const embedTexts = async (
  texts: string[],
  model = READMEA.EMBED_MODEL,
): Promise<number[][]> => {
  if (!READMEA.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required.');
  const base = (READMEA.OPENAI_BASE_URL || '').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base) || base.includes('${')) {
    throw new Error(
      'Set OPENAI_BASE_URL to a plain URL like https://api.openai.com/v1',
    );
  }
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const http = axios.create({
    baseURL: base,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${READMEA.OPENAI_API_KEY}`,
    },
    timeout: 60_000,
  });

  const out: number[][] = [];
  const BATCH = 64;

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    try {
      const res = await http.post('/embeddings', { model, input: batch });
      const data = res.data?.data;
      if (!Array.isArray(data) || data.length !== batch.length) {
        throw new Error('Invalid embeddings response shape.');
      }
      for (const item of data) {
        if (!Array.isArray(item.embedding))
          throw new Error('Missing embedding array.');
        out.push(item.embedding.map((x: any) => Number(x)));
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      const hint =
        status === 401
          ? 'Check OPENAI_API_KEY and account/project permissions for embeddings.'
          : '';
      throw new Error(
        `Embeddings request failed ${status ?? ''} ${JSON.stringify(body ?? {})} ${hint}`.trim(),
      );
    }
  }
  return out;
};
