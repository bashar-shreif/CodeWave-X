import axios from 'axios';
import { READMEA } from '../agent/config';

export const embedTexts = async (
  texts: string[],
  model = READMEA.EMBED_MODEL,
): Promise<number[][]> => {
  if (!READMEA.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is required for embeddings (cheap-embed disabled).',
    );
  }
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const http = axios.create({
    baseURL: READMEA.OPENAI_BASE_URL.replace(/\/$/, ''),
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
    const res = await http.post('/embeddings', { model, input: batch });
    const data = res.data?.data;
    if (!Array.isArray(data) || data.length !== batch.length) {
      throw new Error('Invalid embeddings response.');
    }
    for (const item of data) {
      if (!Array.isArray(item.embedding)) {
        throw new Error('Missing embedding array in response.');
      }
      out.push(item.embedding.map((x: any) => Number(x)));
    }
  }
  return out;
};
