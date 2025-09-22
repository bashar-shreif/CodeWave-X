import type { GraphState } from '../agent/state';

const arr = <T = any>(v: any): T[] =>
  Array.isArray(v) ? v : v != null ? [v] : [];
const uniq = <T = any>(a: T[]) => Array.from(new Set(a.filter(Boolean)));

export const mergeSignalsNode = async (
  state: GraphState,
): Promise<GraphState> => {
  const routesIn: any = state.routes || {};
  const testsIn: any = state.tests || {};
  const ciIn: any = state.ci || {};
  const docsIn: any = state.docs || {};
  const secIn: any = state.security || {};
  const cfgIn: any = state.config || {};

  // Routes
  const routeItems = arr<any>(routesIn.routes ?? routesIn.items).map((r) => {
    if (typeof r === 'string') return { method: '', path: r };
    return {
      framework: r.framework ?? routesIn.framework,
      method: r.method ?? r.http ?? r.verb ?? '',
      path: r.path ?? r.route ?? r.url ?? '',
      file: r.file,
      line: r.line,
    };
  });
  const routes = {
    ...routesIn,
    items: routeItems,
    count:
      typeof routesIn.count === 'number' ? routesIn.count : routeItems.length,
  };

  // Tests
  const frameworks = uniq(arr<string>(testsIn.frameworks));
  const coverage = testsIn.coverage
    ? {
        source: testsIn.coverage.source ?? testsIn.coverage.tool ?? null,
        linesPct:
          typeof testsIn.coverage.linesPct === 'number'
            ? testsIn.coverage.linesPct
            : undefined,
        statementsPct:
          typeof testsIn.coverage.statementsPct === 'number'
            ? testsIn.coverage.statementsPct
            : undefined,
        branchesPct:
          typeof testsIn.coverage.branchesPct === 'number'
            ? testsIn.coverage.branchesPct
            : undefined,
      }
    : undefined;
  const testFiles =
    testsIn.locations?.testFiles ??
    (Array.isArray(testsIn.files) ? testsIn.files.length : undefined) ??
    (typeof testsIn.count === 'number' ? testsIn.count : undefined) ??
    0;
  const tests = {
    ...testsIn,
    frameworks,
    coverage,
    locations: { ...(testsIn.locations || {}), testFiles },
  };

  // CI
  const ciProviders = uniq(arr<string>(ciIn.providers));
  const ciFiles = uniq(arr<string>(ciIn.files));
  const ci = {
    ...ciIn,
    providers: ciProviders,
    files: ciFiles,
    status: {
      ...(ciIn.status || {}),
      hasCI: ciProviders.length > 0 || ciFiles.length > 0,
    },
  };

  // Docs
  const topics =
    typeof docsIn.topics === 'object' && docsIn.topics ? docsIn.topics : {};
  const index = {
    ...(docsIn.index || {}),
    rootReadme:
      docsIn.index?.rootReadme ?? (state.manifest ? 'README.md' : undefined),
    docsDirs: uniq(arr<string>(docsIn.index?.docsDirs)),
    siteGenerators: uniq(arr<string>(docsIn.index?.siteGenerators)),
  };
  const docs = { ...docsIn, index, topics };

  // Security
  const sec = {
    ...secIn,
    status: {
      ...(secIn.status || {}),
      riskScore: Number(secIn.status?.riskScore ?? 0),
    },
    env: { files: uniq(arr<string>(secIn.env?.files)) },
    libs: {
      security: uniq(arr<string>(secIn.libs?.security)),
      auth: uniq(arr<string>(secIn.libs?.auth)),
      crypto: uniq(arr<string>(secIn.libs?.crypto)),
      scanners: uniq(arr<string>(secIn.libs?.scanners)),
    },
    policies: {
      corsWildcard: uniq(arr<string>(secIn.policies?.corsWildcard)),
      debugTrue: uniq(arr<string>(secIn.policies?.debugTrue)),
    },
    sensitiveFiles: uniq(arr<string>(secIn.sensitiveFiles)),
  };

  // Config
  const config = {
    ...cfgIn,
    bundlers: uniq(arr<string>(cfgIn.bundlers)),
    builders: uniq(arr<string>(cfgIn.builders)),
    linters: uniq(arr<string>(cfgIn.linters)),
    formatters: uniq(arr<string>(cfgIn.formatters)),
    cssTools: uniq(arr<string>(cfgIn.cssTools)),
    ts: cfgIn.ts
      ? {
          enabled: !!cfgIn.ts.enabled,
          target: cfgIn.ts.target ?? cfgIn.ts.compilerOptions?.target,
          module: cfgIn.ts.module ?? cfgIn.ts.compilerOptions?.module,
          strict: cfgIn.ts.strict ?? cfgIn.ts.compilerOptions?.strict ?? false,
        }
      : undefined,
  };

  return { ...state, routes, tests, ci, docs, security: sec, config };
};
