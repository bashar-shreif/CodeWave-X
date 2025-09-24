import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import type { GraphState } from '../agent/state';

export const ingestRepoNode = async (
  state: GraphState,
): Promise<Partial<GraphState>> => {
  const candidate =
    state?.repo?.root ?? state?.repoRoot ?? state?.input?.repoRoot;

  if (!candidate || typeof candidate !== 'string') {
    throw new Error('repo.root missing: provide repoRoot in initial state');
  }

  const abs = path.resolve(candidate);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    throw new Error(`repoRoot not found or not a directory: ${candidate}`);
  }

  const hash =
    state?.repo?.hash ??
    state?.repoHash ??
    createHash('sha1').update(abs).digest('hex').slice(0, 12);

  return {
    repo: { ...(state as any).repo, root: abs, hash },
    repoRoot: abs,
    repoHash: hash,
    meta: { ...((state as any).meta || {}), ingestedAt: Date.now() },
  } as any;
};
