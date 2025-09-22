type GraphState = {
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
