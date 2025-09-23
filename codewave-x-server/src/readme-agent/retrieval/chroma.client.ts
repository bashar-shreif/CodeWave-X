import axios, { AxiosInstance } from 'axios';
import { READMEA } from '../agent/config';

type AddPayload = {
  ids: string[];
  embeddings: number[][];
  documents: string[];
  metadatas: Record<string, any>[];
};

export class ChromaClient {
  private http: AxiosInstance;

  constructor(base = READMEA.CHROMA_URL) {
    this.http = axios.create({
      baseURL: base.replace(/\/$/, ''),
      headers: { 'content-type': 'application/json' },
      timeout: 20_000,
    });
  }

  private async getCollectionsByName(name: string) {
    const res = await this.http.get('/api/v1/collections', {
      params: { name },
    });
    return res.data as { collections: Array<{ id: string; name: string }> };
  }

  async ensureCollection(name: string): Promise<{ id: string }> {
    try {
      const got = await this.getCollectionsByName(name);
      const found = got?.collections?.find((c) => c.name === name);
      if (found) return { id: found.id };
    } catch {}
    const res = await this.http.post('/api/v1/collections', { name });
    return res.data as { id: string };
  }

  async add(collectionId: string, payload: AddPayload): Promise<void> {
    await this.http.post(`/api/v1/collections/${collectionId}/add`, payload);
  }
}
