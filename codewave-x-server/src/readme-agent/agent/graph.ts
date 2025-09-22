import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { Channels } from './state';
import { ingestRepoNode } from '../nodes/ingestRepo.node';
import { scanNode } from '../nodes/scan.node';
import { depsNode } from '../nodes/deps.node';
import { routesNode } from '../nodes/routes.node';
import { architectureNode } from '../nodes/architecture.node';

export const compileReadmeGraph = () => {
  const g = new StateGraph(Channels);

  g.addNode('IngestRepo', ingestRepoNode);
  g.addNode('Scan', scanNode);
  g.addNode('Deps', depsNode);
  g.addNode('Routes', routesNode);
  g.addNode('Architecture', architectureNode);

  (g as any).addEdge(START, 'IngestRepo');
  (g as any).addEdge('IngestRepo', 'Scan');
  (g as any).addEdge('Scan', 'Deps');
  (g as any).addEdge('Deps', 'Routes');
  (g as any).addEdge('Routes', 'Architecture');
  (g as any).addEdge('Architecture', END);
  return g.compile();
};
