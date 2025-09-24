import { StateGraph, START, END } from '@langchain/langgraph';
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
import { buildEmbeddingsNode } from '../nodes/buildEmbeddings.node';

const tap = (name: string, fn: any) => async (s: any, c: any) => {
  console.log(`[IN  ${name}] keys:`, Object.keys(s || {}));
  const out = await fn(s, c);
  const preview =
    typeof out?.readme?.final === 'string'
      ? out.readme.final.slice(0, 120)
      : typeof out?.artifacts === 'object'
        ? 'artifacts:' +
          (Array.isArray(out.artifacts)
            ? out.artifacts.length
            : Object.keys(out.artifacts).length)
        : '';
  console.log(`[OUT ${name}] keys:`, Object.keys(out || {}), preview);
  return out;
};

export const compileReadmeGraph = () => {
  const g = new StateGraph(Channels);

  g.addNode('Routes', tap('Routes', routesNode));
  g.addNode('Deps', tap('Deps', depsNode));
  g.addNode('IngestRepo', tap('IngestRepo', ingestRepoNode));
  g.addNode('Scan', tap('Scan', scanNode));
  g.addNode('Architecture', tap('Architecture', architectureNode));
  g.addNode('Tests', tap('Tests', testsNode));
  g.addNode('Config', tap('Config', configNode));
  g.addNode('CI', tap('CI', ciNode));
  g.addNode('Docs', tap('Docs', docsNode));
  g.addNode('Security', tap('Security', securityNode));
  g.addNode('MergeSignals', tap('MergeSignals', mergeSignalsNode));
  g.addNode('WriteSections', tap('WriteSections', writeSectionsNode));
  g.addNode('Finalize', tap('Finalize', finalizeNode));

  // g.addNode('Routes', routesNode);
  // g.addNode('Deps', depsNode);
  // g.addNode('IngestRepo', ingestRepoNode);
  // g.addNode('Scan', scanNode);
  // g.addNode('Architecture', architectureNode);
  // g.addNode('Tests', testsNode);
  // g.addNode('Config', configNode);
  // g.addNode('CI', ciNode);
  // g.addNode('Docs', docsNode);
  // g.addNode('Security', securityNode);
  // g.addNode('MergeSignals', mergeSignalsNode);
  // g.addNode('WriteSections', writeSectionsNode);
  // g.addNode('Finalize', finalizeNode));
  // g.addNode('EmitArtifacts', emitArtifactsNode);

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

  (g as any).addEdge('MergeSignals', 'WriteSections');

  // (g as any).addEdge('MergeSignals', 'AggregateSubprojects');
  // (g as any).addEdge('AggregateSubprojects', 'BuildEmbeddings');
  // (g as any).addEdge('BuildEmbeddings', 'WriteSections');

  (g as any).addEdge('WriteSections', 'Finalize');
  (g as any).addEdge('Finalize', END);
  // (g as any).addEdge('EmitArtifacts', END);

  return g.compile();
};
export const compile = () => compileReadmeGraph();
export const graph = compile();
export default graph;