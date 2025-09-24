import * as fs from 'fs';
import * as path from 'path';
import { READMEA, embedIndexPathFor } from '../../agent/config';
import { selectFiles } from '../../retrieval/selectFiles.util';
import { chunkFiles } from '../../retrieval/chunker.util';
import {
  atomicWriteJson,
  ensureDir,
  isFreshIndex,
} from '../../retrieval/helpers';
import type { EmbedIndex } from '../../types/retrieval/retrieval.types';
import { ChromaClient } from '../../retrieval/chroma.client';
import { embedTexts } from '../../retrieval/providerEmbed.util';
import {
  BuildEmbeddingsInput,
  BuildEmbeddingsOutput,
} from '../../types/tools/io.type';

export const buildEmbeddings = async (
  input: BuildEmbeddingsInput,
): Promise<BuildEmbeddingsOutput> => {
  const { repoRoot, repoHash, force } = input;
  const indexPath = embedIndexPathFor(repoHash);

  if (!force && fs.existsSync(indexPath) && isFreshIndex(indexPath, repoRoot)) {
    const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as EmbedIndex;
    return {
      indexPath,
      stats: { files: idx.stats.files, chunks: idx.stats.chunks, dim: idx.dim },
    };
  }

  const { files, bytes } = selectFiles(repoRoot);
  const raw = chunkFiles(files, repoRoot);
  const texts = raw.map((c) => c.text);

  const vecs = await embedTexts(texts, READMEA.EMBED_MODEL);
  const dim = vecs[0]?.length || 0;

  const chunks = raw.map((c, i) => ({
    id: c.id,
    rel: c.rel,
    start: c.start,
    end: c.end,
    lang: c.lang,
    sha1: c.sha1,
    v: vecs[i],
  }));

  const index: EmbedIndex = {
    version: 1,
    repoHash,
    model: `provider:${READMEA.EMBED_MODEL}`,
    dim,
    chunks,
    stats: { files: files.length, chunks: chunks.length, bytes },
  };

  ensureDir(path.dirname(indexPath));
  atomicWriteJson(indexPath, index);

  if (READMEA.EMBED_BACKEND === 'chroma') {
    try {
      const client = new ChromaClient();
      const { id: colId } = await client.ensureCollection(repoHash);
      const B = 100;
      for (let i = 0; i < chunks.length; i += B) {
        const batch = chunks.slice(i, i + B);
        await client.add(colId, {
          ids: batch.map((x) => x.id),
          embeddings: batch.map((x) => x.v),
          documents: batch.map((x, j) => `# ${x.rel}\n\n${texts[i + j] ?? ''}`),
          metadatas: batch.map((x) => ({
            rel: x.rel,
            start: x.start,
            end: x.end,
            lang: x.lang,
          })),
        });
      }
    } catch {
      // non-fatal
    }
  }

  return {
    indexPath,
    stats: { files: files.length, chunks: chunks.length, dim },
  };
};

export default buildEmbeddings;