import path from 'path';
import fs from 'fs/promises';
import type { GraphState } from '../agent/state';
import type { ListFilesInput } from '../types/tools/io.type';
import { listFiles } from '../tools/list-files';

export const ingestRepoNode = async (
  state: GraphState,
): Promise<GraphState> => {
  const repoRoot = state.repoRoot;
  if (!repoRoot) throw new Error('IngestRepo: repoRoot is required');

  try {
    const st = await fs.stat(repoRoot);
    if (!st.isDirectory()) throw new Error();
  } catch {
    throw new Error(
      `IngestRepo: repoRoot not found or not a directory -> ${path.resolve(repoRoot)}`,
    );
  }

  const { manifest, repoHash } = await listFiles(
    repoRoot as unknown as ListFilesInput,
  );
  return { ...state, manifest, repoHash };
};
