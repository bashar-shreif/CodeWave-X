import type { GraphState } from '../agent/state';
import { summarizeRoutes } from '../tools/summarize-routes';

export const routesNode = async (state: GraphState): Promise<GraphState> => {
  const { repoRoot, manifest, stack } = state;
  if (!repoRoot) throw new Error('Routes: repoRoot is required');
  if (!manifest) throw new Error('Routes: manifest is required');
  if (!stack) throw new Error('Routes: stack is required');

  const routes = await summarizeRoutes({ repoRoot, manifest, stack });
  return { ...state, routes };
};
