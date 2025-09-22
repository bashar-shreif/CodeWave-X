import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { Channels } from './state';
import { ingestRepoNode } from '../nodes/ingestRepo.node';
import { scanNode } from '../nodes/scan.node';
import { depsNode } from '../nodes/deps.node';
import { routesNode } from '../nodes/routes.node';
import { architectureNode } from '../nodes/architecture.node';
import { testsNode } from '../nodes/tests.node';
import { configNode } from '../nodes/config.node';
import { ciNode } from '../nodes/ci.node';
import { docsNode } from '../nodes/docs.node';
import { securityNode } from '../nodes/security.node';
import { mergeSignalsNode } from '../nodes/mergeSignals.node';
import { writeSectionsNode } from '../nodes/writeSections.node';
import { finalizeNode } from '../nodes/finalize.node';
import { emitArtifactsNode } from '../nodes/emitArtifacts.node';
import { aggregateSubprojectsNode } from '../nodes/aggregateSubproject.node';

export const compileReadmeGraph = () => {
  const g = new StateGraph(Channels);

  g.addNode('Routes', routesNode);
  g.addNode('Deps', depsNode);
  g.addNode('IngestRepo', ingestRepoNode);
  g.addNode('Scan', scanNode);
  g.addNode('Architecture', architectureNode);
  g.addNode('Tests', testsNode);
  g.addNode('Config', configNode);
  g.addNode('CI', ciNode);
  g.addNode('Docs', docsNode);
  g.addNode('Security', securityNode);
  g.addNode('MergeSignals', mergeSignalsNode);
  g.addNode('WriteSections', writeSectionsNode);
  g.addNode('Finalize', finalizeNode);
  g.addNode('EmitArtifacts', emitArtifactsNode);
  g.addNode('AggregateSubprojects', aggregateSubprojectsNode);

  (g as any).addEdge(START, 'IngestRepo');
  (g as any).addEdge('IngestRepo', 'Scan');
  (g as any).addEdge('Scan', 'Deps');
  (g as any).addEdge('Deps', 'Routes');
  (g as any).addEdge('Routes', 'Architecture');

  (g as any).addEdge('Architecture', 'Tests');
  (g as any).addEdge('Architecture', 'Config');
  (g as any).addEdge('Architecture', 'CI');
  (g as any).addEdge('Architecture', 'Docs');
  (g as any).addEdge('Architecture', 'Security');

  (g as any).addEdge('Tests', 'MergeSignals');
  (g as any).addEdge('Config', 'MergeSignals');
  (g as any).addEdge('CI', 'MergeSignals');
  (g as any).addEdge('Docs', 'MergeSignals');
  (g as any).addEdge('Security', 'MergeSignals');

  (g as any).addEdge('MergeSignals', 'AggregateSubprojects');
  (g as any).addEdge('AggregateSubprojects', 'WriteSections');
  (g as any).addEdge('WriteSections', 'Finalize');
  (g as any).addEdge('Finalize', 'EmitArtifacts');
  (g as any).addEdge('EmitArtifacts', END);

  return g.compile();
};
