import path from 'path';
import { SummarizeTestsOutput } from 'src/readme-agent/types/tools/io.type';
import {
  walk,
  detectByFiles,
  detectByManifests,
  pathExists,
  parseCoverageSummaryJson,
  parseJUnit,
  parseLcov,
} from './helpers';

export const summarizeTests = async (
  repoRoot: string,
): Promise<SummarizeTestsOutput> => {
  const files = await walk(repoRoot);

  const byFiles = detectByFiles(files, repoRoot);
  const frameworks = new Set<string>(byFiles.frameworks);
  const runners = new Set<string>(byFiles.runners);
  const assertions = new Set<string>(byFiles.assertions);
  const scripts: Record<string, string> = {};

  await detectByManifests(repoRoot, {
    frameworks,
    runners,
    assertions,
    scripts,
  });

  // coverage detection
  const covCandidates = [
    path.join(repoRoot, 'coverage', 'coverage-summary.json'),
    path.join(repoRoot, 'coverage', 'lcov.info'),
    path.join(repoRoot, 'coverage', 'junit.xml'),
  ];
  let coverage:
    | {
        source: 'coverage-summary.json';
        linesPct?: number;
        statementsPct?: number;
        branchesPct?: number;
        functionsPct?: number;
      }
    | { source: 'lcov.info'; linesPct?: number }
    | {
        source: 'junit.xml';
        totals?: { tests?: number; failures?: number; skipped?: number };
      }
    | { source: null } = { source: null };

  if (await pathExists(covCandidates[0])) {
    const j = await parseCoverageSummaryJson(covCandidates[0]);
    if (j) coverage = j;
  } else if (await pathExists(covCandidates[1])) {
    const j = await parseLcov(covCandidates[1]);
    if (j) coverage = j;
  } else if (await pathExists(covCandidates[2])) {
    const j = await parseJUnit(covCandidates[2]);
    if (j) coverage = j;
  }

  const notes: string[] = [];
  if (byFiles.testFiles === 0 && frameworks.size === 0)
    notes.push('No test files or frameworks detected');
  if (coverage.source === null)
    notes.push('No coverage artifacts found in ./coverage');

  return {
    frameworks: [...frameworks].sort(),
    runners: [...runners].sort(),
    assertionLibs: [...assertions].sort(),
    scripts,
    locations: {
      patternsFound: [...new Set(byFiles.pattHits)],
      testDirs: byFiles.testDirs,
      testFiles: byFiles.testFiles,
    },
    coverage,
    status: {
      hasTests: byFiles.testFiles > 0 || frameworks.size > 0,
      notes,
    },
  };
};

export default summarizeTests;
