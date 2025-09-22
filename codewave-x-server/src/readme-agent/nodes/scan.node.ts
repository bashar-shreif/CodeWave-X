// src/readme-agent/nodes/scan.node.ts
import type { GraphState } from '../agent/state';
import { scanLanguages } from '../tools/scan-languages';
import { detectStack } from '../tools/detect-stacks';

export const scanNode = async (state: GraphState): Promise<GraphState> => {
  const { repoRoot, manifest } = state;
  if (!repoRoot) throw new Error('Scan: repoRoot is required');

  const langProfile = await scanLanguages({ repoRoot, manifest });

  const stack = await detectStack({ repoRoot, manifest });

  return { ...state, langProfile, stack };
};
