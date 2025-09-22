import type { GraphState } from '../agent/state';
import { summarizeRoutes } from '../tools/summarize-routes';

export const routesNode = async (
  s: GraphState,
): Promise<Partial<GraphState>> => {
  const routes = await summarizeRoutes({
    repoRoot: s.repoRoot,
    manifest: s.manifest,
    stack: s.stack,
  });
  return { routes };
};
