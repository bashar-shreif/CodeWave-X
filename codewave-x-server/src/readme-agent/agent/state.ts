import { Annotation } from '@langchain/langgraph';

export type GraphState = {
  repoRoot: string;
  repoHash?: string;
  manifest?: any;
  langProfile?: any;
  stack?: any;
  deps?: any;
  routes?: any;
  architecture?: any;
  tests?: any;
  config?: any;
  ci?: any;
  docs?: any;
  security?: any;
  draft?: { sections?: Record<string, string> };
  final?: { markdown?: string };
};

export const Channels = Annotation.Root({
  repoRoot: Annotation<string>(),
  repoHash: Annotation<string | undefined>(),
  manifest: Annotation<any | undefined>(),
  langProfile: Annotation<any | undefined>(),
  stack: Annotation<any | undefined>(),
  deps: Annotation<any | undefined>(),
  routes: Annotation<any | undefined>(),
  architecture: Annotation<any | undefined>(),
  tests: Annotation<any | undefined>(),
  config: Annotation<any | undefined>(),
  ci: Annotation<any | undefined>(),
  docs: Annotation<any | undefined>(),
  security: Annotation<any | undefined>(),
  draft: Annotation<any | undefined>(),
  final: Annotation<any | undefined>(),
});
