import { Annotation } from '@langchain/langgraph';

export type GraphState = {
  repo: { root: string; hash?: string };
  flags?: { useLLM?: boolean };

  // legacy flat keys (required so nodes can pass to tool IO types)
  repoRoot: string;
  repoHash: string;

  manifest?: any;
  stack?: any;
  langProfile?: any;
  deps?: any;
  routes?: any;
  architecture?: any;
  tests?: any;
  config?: any;
  ci?: any;
  docs?: any;
  security?: any;

  decisions?: any;

  writer?: { sections?: Array<{ id: string; title: string; body: string }>; markdown?: string };
  draft?: { title?: string; sections?: Record<string, any> | Array<{ id: string; title: string; body: string }> };
  final?: { markdown: string };

  outputs?: any;
  meta?: any;
  input?: { repoRoot?: string };

  __progress?: (kind: 'node_start' | 'node_end', node: string) => void;
};

const merge = <T extends object>(a: T | undefined, b: T | undefined): T => ({ ...(a as any), ...(b as any) });

export const Channels = Annotation.Root({
  repo: Annotation<{ root: string; hash?: string }>({ reducer: (a, b) => merge(a, b) }),
  flags: Annotation<{ useLLM?: boolean }>({ reducer: (a, b) => merge(a, b) }),

  repoRoot: Annotation<string>({ reducer: (_a, b) => b }),
  repoHash: Annotation<string>({ reducer: (_a, b) => b }),

  manifest: Annotation<any>({ reducer: (_a, b) => b }),
  stack: Annotation<any>({ reducer: (_a, b) => b }),
  langProfile: Annotation<any>({ reducer: (_a, b) => b }),
  deps: Annotation<any>({ reducer: (_a, b) => b }),
  routes: Annotation<any>({ reducer: (_a, b) => b }),
  architecture: Annotation<any>({ reducer: (_a, b) => b }),
  tests: Annotation<any>({ reducer: (_a, b) => b }),
  config: Annotation<any>({ reducer: (_a, b) => b }),
  ci: Annotation<any>({ reducer: (_a, b) => b }),
  docs: Annotation<any>({ reducer: (_a, b) => b }),
  security: Annotation<any>({ reducer: (_a, b) => b }),

  decisions: Annotation<any>({ reducer: (a, b) => merge(a, b) }),

  writer: Annotation<{ sections?: any[]; markdown?: string }>({
    reducer: (a, b) => {
      const base = merge(a, b);
      const sections = (b?.sections ?? a?.sections) as any[] | undefined;
      return sections ? { ...base, sections } : base;
    },
  }),

  draft: Annotation<{ title?: string; sections?: any }>({ reducer: (a, b) => merge(a, b) }),
  final: Annotation<{ markdown: string }>({ reducer: (_a, b) => b }),

  outputs: Annotation<any>({ reducer: (a, b) => merge(a, b) }),
  meta: Annotation<any>({ reducer: (a, b) => merge(a, b) }),
  input: Annotation<{ repoRoot?: string }>({ reducer: (a, b) => merge(a, b) }),
});
