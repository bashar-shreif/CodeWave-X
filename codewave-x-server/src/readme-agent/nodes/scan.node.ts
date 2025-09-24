import type { GraphState } from '../agent/state';
import { listFiles } from '../tools/list-files';
import { scanLanguages } from '../tools/scan-languages';
import { detectStack } from '../tools/detect-stacks';

export const scanNode = async (s: GraphState): Promise<Partial<GraphState>> => {
  const repoRoot = s.repoRoot || s.repo?.root;
  if (!repoRoot) throw new Error('scanNode: repoRoot missing');

  const { manifest } = await listFiles({ repoUri: repoRoot });

  const langProfile = await scanLanguages({ repoRoot, manifest } as any);
  const stack = await detectStack({ repoRoot, manifest } as any);

  return { manifest, langProfile, stack };
};
