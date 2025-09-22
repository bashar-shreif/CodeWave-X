import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { Channels } from './state';
import { ingestRepoNode } from '../nodes/ingestRepo.node';
import { scanNode } from '../nodes/scan.node';
import { depsNode } from '../nodes/deps.node';

export const compileReadmeGraph = () => {
  const g = new StateGraph(Channels);

  g.addNode('IngestRepo', ingestRepoNode);
  g.addNode('Scan', scanNode);
  g.addNode('Deps', depsNode);

  (g as any).addEdge(START, 'IngestRepo');
  (g as any).addEdge('IngestRepo', 'Scan');
  (g as any).addEdge('Scan', 'Deps');
  (g as any).addEdge('Deps', END);
  return g.compile();
};
